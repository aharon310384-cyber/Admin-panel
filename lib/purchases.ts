import "server-only";

import { after } from "next/server";
import type { Prisma, PurchaseLineStatus, PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addLedgerEntry, lockClientMoney } from "@/lib/balance";
import { purchaseTotals, round2, yuan } from "@/lib/purchase-money";
import { notifyPurchaseClient, type PurchaseEvent } from "@/lib/purchase-notify";

// Покупка под ключ (docs/product/задание-выкуп.md): настройки компании, пересчёт денег и статуса покупки по строкам.

/** Чьи покупки: компания клиентов (её бренд — в кабинете). Компаний ещё нет — null. */
export async function purchaseCompanyId(): Promise<string | null> {
  const company = await prisma.company.findFirst({ where: { cabinetBrand: true }, select: { id: true }, orderBy: { createdAt: "asc" } });
  return company?.id ?? null;
}

export type PurchaseSettingsView = {
  id: string | null;
  companyId: string | null;
  clientBuyoutOnly: boolean;
  commissionPercent: number | null;
  commissionMinCny: number | null;
  numberPrefix: string | null;
  rejectReasons: string[];
  rulesText: string | null;
  topUpMethods: string[];
  topUpInstructions: string | null;
  topUpConfirmAboveCny: number | null;
};

const num = (value: Prisma.Decimal | null | undefined) => (value == null ? null : Number(value));

/** Настройки покупки компании клиентов; нет своих — общие (без компании); нет и их — пустые. */
export async function getPurchaseSettings(): Promise<PurchaseSettingsView> {
  const companyId = await purchaseCompanyId();
  const settings =
    (companyId ? await prisma.purchaseSettings.findUnique({ where: { companyId } }) : null) ??
    (await prisma.purchaseSettings.findFirst({ where: { companyId: null } }));
  return {
    id: settings?.id ?? null,
    companyId: settings?.companyId ?? companyId,
    clientBuyoutOnly: settings?.clientBuyoutOnly ?? false,
    commissionPercent: num(settings?.commissionPercent),
    commissionMinCny: num(settings?.commissionMinCny),
    numberPrefix: settings?.numberPrefix ?? null,
    rejectReasons: settings?.rejectReasons ?? [],
    rulesText: settings?.rulesText ?? null,
    topUpMethods: settings?.topUpMethods ?? [],
    topUpInstructions: settings?.topUpInstructions ?? null,
    topUpConfirmAboveCny: num(settings?.topUpConfirmAboveCny),
  };
}

export const COMMISSION_MISSING = "Не задан процент комиссии — задайте его в «Покупки → Настройки покупки».";

/** Деньги клиента уже взяты (было первое списание). */
export const PAID_STATUSES: PurchaseStatus[] = ["PAID", "PURCHASED", "AT_WAREHOUSE", "SHIPPED", "RETURNED"];
/** Покупка закрыта — кнопок больше нет. */
export const FINAL_STATUSES: PurchaseStatus[] = ["REJECTED", "CANCELED", "RETURNED"];
/** Порядок строки: дальше по пути — больше. */
const LINE_STEP: Record<PurchaseLineStatus, number> = { WAITING: 0, PURCHASED: 1, SHIPPED: 2, AT_WAREHOUSE: 3, REJECTED: -1, RETURNED: -1 };

/** Сколько клиент сейчас заплатил за покупку: списания минус возвраты по покупке (возврат товара — отдельно). */
export async function purchasePaidNet(tx: Prisma.TransactionClient | typeof prisma, purchaseId: string): Promise<number> {
  const sum = await tx.clientLedger.aggregate({
    where: { purchaseId, deletedAt: null, reason: { in: ["PURCHASE_PAYMENT", "PURCHASE_REFUND"] } },
    _sum: { amount: true },
  });
  return round2(Number(sum._sum.amount ?? 0));
}

export type SettleResult = { status: PurchaseStatus; changed: boolean; refunded: number; due: number; events: PurchaseEvent[] };

/**
 * Пересчитать покупку после любого изменения строк (цена, отказ, выкуп, трек, приём, возврат). Вызывать в транзакции,
 * где уже заняты деньги клиента (lockClientMoney):
 * 1) итог — по строкам без отказа, комиссия — по проценту на момент цены (или ручная);
 * 2) клиент заплатил больше итога (строку отменили, цена упала) — разница сама возвращается на баланс;
 *    меньше (продавец поднял цену) — доплата: клиент видит «Доплатить» в кабинете;
 * 3) статус покупки — по строкам: все выкуплены → «Выкуплена», все на складе → «На складе», заказы в посылке →
 *    «Отправлена», все строки в отказе → «Отказ», все купленные возвращены → «Возврат»;
 * 4) даты шагов — когда шаг достигнут впервые.
 */
export async function settlePurchase(
  tx: Prisma.TransactionClient,
  purchaseId: string,
  actor: { staffId: string | null; byClient?: boolean }
): Promise<SettleResult> {
  const purchase = await tx.purchase.findUniqueOrThrow({
    where: { id: purchaseId },
    include: { lines: { include: { order: { select: { parcelId: true } } } } },
  });
  const events: PurchaseEvent[] = [];
  const active = purchase.lines.filter((l) => l.status !== "REJECTED");
  const data: Prisma.PurchaseUpdateInput = {};

  // 1. итог
  let total = purchase.totalCny != null ? Number(purchase.totalCny) : null;
  if (purchase.pricedAt) {
    const totals = purchaseTotals(
      purchase.lines.map((l) => ({ status: l.status, quantity: l.quantity, unitPriceCny: num(l.unitPriceCny), chinaDeliveryCny: num(l.chinaDeliveryCny) })),
      {
        manual: purchase.commissionManual ? num(purchase.commissionCny) : null,
        rule: { percent: num(purchase.commissionPercent), minCny: num(purchase.commissionMinCny) },
      }
    );
    const commission = active.length ? totals.commissionCny ?? 0 : 0;
    total = active.length ? round2(totals.goodsCny + totals.chinaDeliveryCny + commission) : 0;
    Object.assign(data, { goodsCny: totals.goodsCny, chinaDeliveryCny: totals.chinaDeliveryCny, commissionCny: commission, totalCny: total });
  }

  // 2. деньги
  const paidStage = PAID_STATUSES.includes(purchase.status) || (purchase.status === "REJECTED" && purchase.paidAt != null);
  let refunded = 0;
  let due = total != null ? round2(total) : 0;
  if (paidStage && total != null) {
    await lockClientMoney(tx, purchase.customerId);
    const paid = await purchasePaidNet(tx, purchaseId);
    if (paid > total) {
      refunded = round2(paid - total);
      await addLedgerEntry(tx, {
        customerId: purchase.customerId,
        amount: -refunded,
        reason: "PURCHASE_REFUND",
        note: total === 0 ? `Возврат по покупке ${purchase.number}: отказ` : `Возврат разницы по покупке ${purchase.number}`,
        createdById: actor.staffId,
        purchaseId,
      });
      events.push("refunded");
    }
    due = paid >= total ? 0 : round2(total - paid);
  }

  // 3. статус по строкам (только после оплаты: до неё строки не двигаются)
  let status = purchase.status;
  if (!paidStage && (status === "NEW" || status === "PRICED") && !active.length) status = "REJECTED";
  if (paidStage) {
    const going = active.filter((l) => l.status !== "RETURNED");
    if (!active.length) status = "REJECTED";
    else if (!going.length) status = "RETURNED";
    else {
      const minStep = Math.min(...going.map((l) => LINE_STEP[l.status]));
      const inParcel = going.every((l) => l.order?.parcelId);
      status = inParcel && minStep >= LINE_STEP.AT_WAREHOUSE ? "SHIPPED" : minStep >= LINE_STEP.AT_WAREHOUSE ? "AT_WAREHOUSE" : minStep >= LINE_STEP.PURCHASED ? "PURCHASED" : "PAID";
    }
  }
  const now = new Date();
  if (status === "PURCHASED" || status === "AT_WAREHOUSE" || status === "SHIPPED") data.purchasedAt = purchase.purchasedAt ?? now;
  if (status === "AT_WAREHOUSE" || status === "SHIPPED") data.arrivedAt = purchase.arrivedAt ?? now;
  if (status === "SHIPPED") data.shippedAt = purchase.shippedAt ?? now;
  const changed = status !== purchase.status;
  if (changed) {
    data.status = status;
    if (status === "REJECTED" && !purchase.rejectReason) data.rejectReason = "Все товары — отказ";
    if (status === "PURCHASED") events.push("purchased");
    if (status === "AT_WAREHOUSE") events.push("at-warehouse");
    if (status === "SHIPPED") events.push("shipped");
    if (status === "REJECTED") events.push("rejected");
  }
  await tx.purchase.update({ where: { id: purchaseId }, data });
  if (changed || refunded) {
    await tx.purchaseStatusHistory.create({
      data: {
        purchaseId,
        status,
        changedById: actor.staffId,
        byClient: Boolean(actor.byClient),
        note: [changed ? null : "Пересчёт", refunded ? `возвращена разница ${yuan(refunded)}` : null].filter(Boolean).join(" · ") || null,
      },
    });
  }
  return { status, changed, refunded, due, events };
}

/** Сообщения клиенту по итогам пересчёта — после ответа, чтобы не задерживать действие. */
export function notifyAfterSettle(purchaseId: string, result: SettleResult) {
  const events = [...new Set(result.events)];
  if (events.length) after(async () => {
    for (const event of events) await notifyPurchaseClient(purchaseId, event);
  });
}

/**
 * Строки «Отправлена продавцом», чей заказ склад принял, — «На складе»; покупка пересчитывается (все на складе →
 * «На складе», заказы в посылке → «Отправлена»). Приём на склад и оформление посылки — работа чата «админка»,
 * поэтому статус подтягивается, когда открывают журнал, карточку или покупки в кабинете. Повторный вызов ничего не меняет.
 */
export async function syncPurchases(where: { customerId?: string; id?: string } = {}): Promise<number> {
  const candidates = await prisma.purchase.findMany({
    where: {
      ...where,
      deletedAt: null,
      status: { in: ["PURCHASED", "AT_WAREHOUSE", "PAID"] },
      lines: {
        some: {
          OR: [
            { status: "SHIPPED", order: { status: { in: ["RECEIVED", "RECEIVED_WITH_DISCREPANCY", "FORMED"] } } },
            { status: "AT_WAREHOUSE", order: { parcelId: { not: null } } },
          ],
        },
      },
    },
    select: { id: true, customerId: true },
  });
  let changed = 0;
  for (const { id, customerId } of candidates) {
    const result = await prisma.$transaction(async (tx) => {
      await lockClientMoney(tx, customerId);
      const lines = await tx.purchaseLine.findMany({
        where: { purchaseId: id, status: "SHIPPED", order: { status: { in: ["RECEIVED", "RECEIVED_WITH_DISCREPANCY", "FORMED"] } } },
        select: { id: true, lineNo: true },
      });
      const now = new Date();
      for (const line of lines) {
        await tx.purchaseLine.update({ where: { id: line.id }, data: { status: "AT_WAREHOUSE", arrivedAt: now } });
      }
      if (lines.length) {
        const current = await tx.purchase.findUniqueOrThrow({ where: { id }, select: { status: true } });
        await tx.purchaseStatusHistory.createMany({
          data: lines.map((l) => ({ purchaseId: id, status: current.status, lineNo: l.lineNo, note: `Строка ${l.lineNo}: на складе` })),
        });
      }
      return settlePurchase(tx, id, { staffId: null });
    });
    if (result.changed) changed += 1;
    notifyAfterSettle(id, result);
  }
  return changed;
}
