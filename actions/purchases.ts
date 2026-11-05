"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { Prisma, Purchase, PurchaseLine, PurchaseLineStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { getFinanceSettings } from "@/lib/finance";
import { addLedgerEntry, lockClientMoney } from "@/lib/balance";
import { purchaseTotals, parseMoney, round2, yuan } from "@/lib/purchase-money";
import { isMarketplace } from "@/lib/purchase-lines";
import { estimatePurchase } from "@/lib/purchase-estimate";
import { COMMISSION_MISSING, PAID_STATUSES, getPurchaseSettings, notifyAfterSettle, purchasePaidNet, settlePurchase } from "@/lib/purchases";
import { createOrderFromLine, publicPhotoUrl } from "@/lib/purchase-order";
import { notifyLineRejected, notifyPurchaseClient } from "@/lib/purchase-notify";
import { ensureBaseline, recordVersion } from "@/lib/versions";

// Действия менеджера с покупкой (карточка /purchases/[id]). Всё, что трогает деньги или статус, идёт в транзакции:
// сначала заняты деньги клиента (lockClientMoney), потом читается покупка, в конце — пересчёт (settlePurchase).
// Так оплата клиента в ту же секунду и действие менеджера не перепутаются.

export type PurchaseActionResult = { ok: true; message?: string } | { ok: false; error: string };

class StepError extends Error {}

const text = (value: FormDataEntryValue | null | undefined, max = 500) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const n = (value: Prisma.Decimal | null | undefined) => (value == null ? null : Number(value));
const LINE_EDITABLE: PurchaseLineStatus[] = ["WAITING"];

type Loaded = Purchase & { lines: (PurchaseLine & { order: { id: string; status: string; number: string | null; parcelId: string | null } | null })[] };

async function run(id: string, work: () => Promise<string | void>): Promise<PurchaseActionResult> {
  try {
    const message = await work();
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${id}`);
    revalidatePath("/cabinet/purchases");
    return { ok: true, message: message || undefined };
  } catch (error) {
    if (error instanceof StepError) return { ok: false, error: error.message };
    console.error("[purchases]", error);
    return { ok: false, error: "Не получилось — попробуйте ещё раз" };
  }
}

/** Транзакция над покупкой: деньги клиента заняты, покупка прочитана заново (со строками и их заказами). */
async function inPurchase<T>(id: string, work: (tx: Prisma.TransactionClient, purchase: Loaded) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const owner = await tx.purchase.findUnique({ where: { id }, select: { customerId: true, deletedAt: true } });
    if (!owner || owner.deletedAt) throw new StepError("Покупка не найдена");
    await lockClientMoney(tx, owner.customerId);
    const purchase = await tx.purchase.findUniqueOrThrow({
      where: { id },
      include: { lines: { orderBy: { lineNo: "asc" }, include: { order: { select: { id: true, status: true, number: true, parcelId: true } } } } },
    });
    return work(tx, purchase);
  });
}

const history = (tx: Prisma.TransactionClient, purchase: Purchase, staffId: string, note: string, lineNo?: number) =>
  tx.purchaseStatusHistory.create({ data: { purchaseId: purchase.id, status: purchase.status, changedById: staffId, lineNo: lineNo ?? null, note } });

type LineInput = { id: string; productName: string; variant: string; quantity: number; unitPriceCny: number | null; chinaDeliveryCny: number | null; marketplace: string; seller: string };

function readLines(raw: FormDataEntryValue | null): LineInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    throw new StepError("Строки не прочитались — обновите страницу");
  }
  if (!Array.isArray(parsed)) throw new StepError("Строки не прочитались — обновите страницу");
  return parsed.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      productName: text(String(row.productName ?? ""), 200),
      variant: text(String(row.variant ?? ""), 200),
      quantity: Number(row.quantity),
      unitPriceCny: parseMoney(String(row.unitPriceCny ?? "")),
      chinaDeliveryCny: parseMoney(String(row.chinaDeliveryCny ?? "")),
      marketplace: String(row.marketplace ?? ""),
      seller: text(String(row.seller ?? ""), 200),
    };
  });
}

/**
 * «Назначить цену» (и «Изменить цену»): цены строк, доставка по Китаю, комиссия; для «под ключ» — страна, получатель,
 * вид доставки, примерный вес и услуги (из них — ориентировочная доставка). После оплаты менять можно только строки,
 * которые ещё не выкуплены: продавец поднял цену — доплата, подешевело — разница сама вернётся на баланс.
 */
export async function savePurchasePrice(id: string, formData: FormData): Promise<PurchaseActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const inputs = readLines(formData.get("lines"));
    const settings = await getPurchaseSettings();
    const manual = formData.get("commissionManual") === "on";
    const manualCommission = manual ? parseMoney(formData.get("commissionCny")) : null;
    if (manual && (manualCommission == null || manualCommission < 0)) throw new StepError("Укажите комиссию");
    const mode = formData.get("mode") === "BUYOUT_ONLY" ? "BUYOUT_ONLY" : "TURNKEY";
    const countryCode = text(formData.get("countryCode"), 2).toUpperCase() || null;
    const deliveryType = text(formData.get("deliveryType"), 20) || null;
    const recipientId = text(formData.get("recipientId"), 40) || null;
    const weight = parseMoney(formData.get("estimatedWeightKg"));
    if (weight != null && (weight < 0 || weight > 1000)) throw new StepError("Примерный вес — от 0 до 1000 кг");
    const services = {
      consolidation: formData.get("consolidationRequested") === "on",
      compactPack: formData.get("compactPackRequested") === "on",
      standardCheck: formData.get("standardCheckRequested") === "on",
      detailedCheck: formData.get("detailedCheckRequested") === "on",
      reinforcedPack: formData.get("reinforcedPackRequested") === "on",
      keepOriginal: formData.get("keepOriginalPackaging") === "on",
    };

    const result = await inPurchase(id, async (tx, purchase) => {
      if (!["NEW", "PRICED", ...PAID_STATUSES].includes(purchase.status) || purchase.status === "RETURNED") throw new StepError("Покупка закрыта");
      const paidStage = PAID_STATUSES.includes(purchase.status);
      const hasOrders = purchase.lines.some((l) => l.orderId);
      if (recipientId) {
        const ok = await tx.recipient.findFirst({ where: { id: recipientId, customerId: purchase.customerId, deletedAt: null }, select: { id: true } });
        if (!ok) throw new StepError("Получатель не из списка клиента");
      }
      if (deliveryType && !(await tx.deliveryMethod.findUnique({ where: { code: deliveryType }, select: { code: true } }))) throw new StepError("Нет такого вида доставки");

      const byId = new Map(inputs.map((input) => [input.id, input]));
      const lines = purchase.lines.map((line) => {
        const input = byId.get(line.id);
        if (!input || !LINE_EDITABLE.includes(line.status)) {
          return { line, status: line.status, quantity: line.quantity, unitPriceCny: n(line.unitPriceCny), chinaDeliveryCny: n(line.chinaDeliveryCny) };
        }
        if (!input.productName) throw new StepError(`Строка ${line.lineNo}: название товара`);
        if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 9999) throw new StepError(`Строка ${line.lineNo}: количество — целое от 1`);
        if (input.unitPriceCny == null || input.unitPriceCny <= 0) throw new StepError(`Строка ${line.lineNo}: цена за штуку`);
        if (input.chinaDeliveryCny != null && input.chinaDeliveryCny < 0) throw new StepError(`Строка ${line.lineNo}: доставка по Китаю не меньше нуля`);
        return { line, input, status: line.status, quantity: input.quantity, unitPriceCny: input.unitPriceCny, chinaDeliveryCny: input.chinaDeliveryCny ?? 0 };
      });

      const rule = { percent: settings.commissionPercent, minCny: settings.commissionMinCny };
      // после оплаты процент — тот, что был, когда клиент соглашался с ценой
      const keptRule = purchase.pricedAt ? { percent: n(purchase.commissionPercent), minCny: n(purchase.commissionMinCny) } : rule;
      const totals = purchaseTotals(lines, { manual: manualCommission, rule: keptRule });
      if (totals.totalCny == null) throw new StepError(COMMISSION_MISSING);

      for (const row of lines) {
        if (!row.input) continue;
        await tx.purchaseLine.update({
          where: { id: row.line.id },
          data: {
            productName: row.input.productName,
            variant: row.input.variant || null,
            quantity: row.quantity,
            unitPriceCny: row.unitPriceCny,
            chinaDeliveryCny: row.chinaDeliveryCny,
            marketplace: isMarketplace(row.input.marketplace) ? row.input.marketplace : row.line.marketplace,
            seller: row.input.seller || null,
          },
        });
      }

      // после заказов шапка закреплена (её поля в форме выключены) — считаем по сохранённой
      const turnkey = (hasOrders ? purchase.mode : mode) === "TURNKEY";
      const estimate = turnkey
        ? await estimatePurchase({
            countryCode: hasOrders ? purchase.countryCode : countryCode,
            deliveryType: hasOrders ? purchase.deliveryType : deliveryType,
            weightKg: weight,
            lineCount: totals.count,
            goodsCny: totals.goodsCny,
            services: hasOrders
              ? {
                  consolidation: purchase.consolidationRequested,
                  compactPack: purchase.compactPackRequested,
                  standardCheck: purchase.standardCheckRequested,
                  detailedCheck: purchase.detailedCheckRequested,
                  reinforcedPack: purchase.reinforcedPackRequested,
                  keepOriginal: purchase.keepOriginalPackaging,
                }
              : services,
          })
        : null;
      const header: Prisma.PurchaseUpdateInput = {
        goodsCny: totals.goodsCny,
        chinaDeliveryCny: totals.chinaDeliveryCny,
        commissionPercent: keptRule.percent,
        commissionMinCny: keptRule.minCny,
        commissionCny: totals.commissionCny,
        commissionManual: manual,
        totalCny: totals.totalCny,
        shippingEstimateCny: estimate?.shippingCny ?? null,
        servicesEstimateCny: estimate?.servicesCny ?? null,
        dutyEstimateCny: estimate?.dutyCny ?? null,
        estimatedWeightKg: weight,
      };
      if (!hasOrders) {
        Object.assign(header, {
          mode,
          countryCode: turnkey ? countryCode : null,
          deliveryType: turnkey ? deliveryType : null,
          recipient: turnkey && recipientId ? { connect: { id: recipientId } } : { disconnect: true },
          consolidationRequested: services.consolidation,
          compactPackRequested: services.compactPack,
          standardCheckRequested: services.standardCheck,
          detailedCheckRequested: services.detailedCheck,
          reinforcedPackRequested: services.reinforcedPack,
          keepOriginalPackaging: services.keepOriginal,
        });
      }
      const wasPriced = purchase.status === "PRICED";
      if (!paidStage) Object.assign(header, { status: "PRICED", pricedAt: purchase.pricedAt ?? new Date() });
      await tx.purchase.update({ where: { id }, data: header });
      await tx.purchaseStatusHistory.create({
        data: {
          purchaseId: id,
          status: paidStage ? purchase.status : "PRICED",
          changedById: session.user.id,
          note: `${paidStage || wasPriced ? "Цена изменена" : "Цена назначена"}: ${yuan(totals.totalCny)}${manual ? " (комиссия вручную)" : ""}`,
        },
      });
      const settled = paidStage ? await settlePurchase(tx, id, { staffId: session.user.id }) : null;
      return { paidStage, settled, total: totals.totalCny };
    });

    if (!result.paidStage) {
      after(() => notifyPurchaseClient(id, "priced"));
      return `Цена ${yuan(result.total)} — клиенту отправлено сообщение`;
    }
    if (result.settled) notifyAfterSettle(id, result.settled);
    if (result.settled?.due) {
      after(() => notifyPurchaseClient(id, "surcharge"));
      return `Цена изменена: клиенту нужно доплатить ${yuan(result.settled.due)} — сообщение отправлено`;
    }
    return result.settled?.refunded ? `Цена изменена: разница ${yuan(result.settled.refunded)} возвращена на баланс` : "Цена изменена";
  });
}

/** «Выкуплено» по строке: сотрудник купил у продавца. Пока клиент не доплатил разницу — нельзя. */
export async function markLinePurchased(id: string, lineId: string, formData: FormData): Promise<PurchaseActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const paidToSellerCny = parseMoney(formData.get("paidToSellerCny"));
    const sellerOrderNo = text(formData.get("sellerOrderNo"), 80);
    if (paidToSellerCny != null && paidToSellerCny < 0) throw new StepError("Сумма продавцу не может быть меньше нуля");
    const settled = await inPurchase(id, async (tx, purchase) => {
      if (!["PAID", "PURCHASED", "AT_WAREHOUSE"].includes(purchase.status)) throw new StepError("Покупают после оплаты клиента");
      const paid = await purchasePaidNet(tx, id);
      if (purchase.totalCny != null && paid < Number(purchase.totalCny)) {
        throw new StepError(`Клиент ещё не доплатил ${yuan(round2(Number(purchase.totalCny) - paid))} — покупать рано`);
      }
      const line = purchase.lines.find((l) => l.id === lineId);
      if (!line || line.status !== "WAITING") throw new StepError("Строка уже выкуплена или закрыта — обновите страницу");
      await tx.purchaseLine.update({
        where: { id: lineId },
        data: { status: "PURCHASED", purchasedAt: new Date(), buyer: "STAFF", sellerOrderNo: sellerOrderNo || line.sellerOrderNo, ...(paidToSellerCny != null ? { paidToSellerCny } : {}) },
      });
      await history(tx, purchase, session.user.id, `Строка ${line.lineNo}: выкуплена${paidToSellerCny != null ? `, продавцу ${yuan(paidToSellerCny)}` : ""}`, line.lineNo);
      return settlePurchase(tx, id, { staffId: session.user.id });
    });
    notifyAfterSettle(id, settled);
  });
}

/**
 * «Вписать трек» по строке. Первый раз: строка — «Отправлена продавцом», программа создаёт заказ ZK-… (раздел 6).
 * Строки с одним треком — заказы одной коробки. Исправить трек можно, пока склад заказ не принял.
 */
export async function setLineTrack(id: string, lineId: string, formData: FormData): Promise<PurchaseActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const track = text(formData.get("sellerTrack"), 80).replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z0-9-]{4,80}$/.test(track)) throw new StepError("Трек-номер — латиница и цифры, от 4 знаков");
    const { exchangeRateCnyPerUsd } = await getFinanceSettings();
    const before = await prisma.purchaseLine.findUnique({ where: { id: lineId }, select: { orderId: true } });
    if (before?.orderId) await ensureBaseline("order", before.orderId);

    const out = await inPurchase(id, async (tx, purchase) => {
      const line = purchase.lines.find((l) => l.id === lineId);
      if (!line) throw new StepError("Строка не найдена");
      if (line.status === "PURCHASED") {
        await tx.purchaseLine.update({ where: { id: lineId }, data: { status: "SHIPPED", sellerTrack: track, shippedAt: new Date() } });
        const fresh = await tx.purchaseLine.findUniqueOrThrow({ where: { id: lineId } });
        const order = await createOrderFromLine(tx, purchase, fresh, { authorId: session.user.id, rateCnyPerUsd: exchangeRateCnyPerUsd });
        await tx.purchaseLine.update({ where: { id: lineId }, data: { orderId: order.id } });
        const sameBox = purchase.lines.filter((l) => l.id !== lineId && l.sellerTrack === track).length;
        await history(tx, purchase, session.user.id, `Строка ${line.lineNo}: трек ${track}, создан заказ ${order.number}${sameBox ? ` (в этом треке ещё ${sameBox})` : ""}`, line.lineNo);
        return { message: `Создан заказ ${order.number}`, settled: await settlePurchase(tx, id, { staffId: session.user.id }), first: true };
      }
      if (line.status !== "SHIPPED") throw new StepError("Трек вписывают после «Выкуплено»");
      if (line.order && !["NEW", "IN_RECEIVING_QUEUE"].includes(line.order.status)) throw new StepError("Склад уже принял заказ — трек не меняется");
      await tx.purchaseLine.update({ where: { id: lineId }, data: { sellerTrack: track } });
      if (line.order) {
        await tx.order.update({ where: { id: line.order.id }, data: { trackNumber: track } });
        await recordVersion("order", line.order.id, { authorId: session.user.id, comment: `Трек из покупки ${purchase.number}` }, tx);
      }
      await history(tx, purchase, session.user.id, `Строка ${line.lineNo}: трек исправлен на ${track}`, line.lineNo);
      return { message: "Трек исправлен", settled: null, first: false };
    });
    if (out.settled) notifyAfterSettle(id, out.settled);
    if (out.first) after(() => notifyPurchaseClient(id, "shipped-by-seller"));
    return out.message;
  });
}

/** «Отказать» по строке (товара нет, подделка): строка не в цене, после оплаты её стоимость сама вернётся на баланс. */
export async function rejectLine(id: string, lineId: string, formData: FormData): Promise<PurchaseActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const reason = [text(formData.get("reason"), 200), text(formData.get("reasonOther"), 300)].filter(Boolean).join(": ");
    if (!reason) throw new StepError("Укажите причину отказа");
    const out = await inPurchase(id, async (tx, purchase) => {
      if (["REJECTED", "CANCELED", "RETURNED"].includes(purchase.status)) throw new StepError("Покупка закрыта");
      const line = purchase.lines.find((l) => l.id === lineId);
      if (!line || !["WAITING", "PURCHASED"].includes(line.status) || line.orderId) throw new StepError("Отказ — до трека; после — «Возврат»");
      await tx.purchaseLine.update({ where: { id: lineId }, data: { status: "REJECTED", rejectReason: reason } });
      await history(tx, purchase, session.user.id, `Строка ${line.lineNo}: отказ — ${reason}`, line.lineNo);
      const rest = purchase.lines.filter((l) => l.id !== lineId && l.status !== "REJECTED").length;
      if (!rest) await tx.purchase.update({ where: { id }, data: { rejectReason: reason } });
      return { lineNo: line.lineNo, settled: await settlePurchase(tx, id, { staffId: session.user.id }), rest };
    });
    if (out.rest) after(() => notifyLineRejected(id, out.lineNo));
    notifyAfterSettle(id, out.settled);
    return out.settled.refunded ? `Возвращено на баланс ${yuan(out.settled.refunded)}` : undefined;
  });
}

/** «Отказать (причина)» всей покупке — пока ни по одной строке нет заказа. Оплачено — всё вернётся на баланс. */
export async function rejectPurchase(id: string, formData: FormData): Promise<PurchaseActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const reason = [text(formData.get("reason"), 200), text(formData.get("reasonOther"), 300)].filter(Boolean).join(": ");
    if (!reason) throw new StepError("Укажите причину отказа");
    const settled = await inPurchase(id, async (tx, purchase) => {
      if (!["NEW", "PRICED", "PAID", "PURCHASED"].includes(purchase.status)) throw new StepError("Покупка уже закрыта или товар в пути — по строкам «Возврат»");
      if (purchase.lines.some((l) => l.orderId)) throw new StepError("По части строк уже есть заказы — отказывайте по строкам");
      await tx.purchaseLine.updateMany({ where: { purchaseId: id, status: { in: ["WAITING", "PURCHASED"] } }, data: { status: "REJECTED", rejectReason: reason } });
      await tx.purchase.update({ where: { id }, data: { rejectReason: reason } });
      await history(tx, purchase, session.user.id, `Отказ: ${reason}`);
      return settlePurchase(tx, id, { staffId: session.user.id });
    });
    notifyAfterSettle(id, { ...settled, events: [...settled.events.filter((e) => e !== "refunded"), "rejected"] });
    return settled.refunded ? `Отказ. Возвращено на баланс ${yuan(settled.refunded)}` : "Отказ";
  });
}

/**
 * «Возврат» по строке: брак или не тот товар — за счёт продавца (клиенту стоимость строки с её долей комиссии);
 * клиент передумал — за счёт клиента (товар минус доставка продавцу). Сумму можно поправить, но не больше стоимости строки.
 * Заказ строки получает «Возвращён», если его ещё не оформили в посылку.
 */
export async function returnLine(id: string, lineId: string, formData: FormData): Promise<PurchaseActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const kind = formData.get("returnKind") === "CLIENT" ? "CLIENT" : formData.get("returnKind") === "SELLER" ? "SELLER" : null;
    const returnCostCny = parseMoney(formData.get("returnCostCny")) ?? 0;
    const refundCny = parseMoney(formData.get("refundCny"));
    const note = text(formData.get("note"), 300);
    if (!kind) throw new StepError("Выберите, за чей счёт возврат");
    if (returnCostCny < 0) throw new StepError("Расходы не могут быть меньше нуля");
    if (refundCny == null || refundCny < 0) throw new StepError("Укажите сумму на баланс клиента (0 — ничего)");
    const before = await prisma.purchaseLine.findUnique({ where: { id: lineId }, select: { orderId: true } });
    if (before?.orderId) await ensureBaseline("order", before.orderId);

    const settled = await inPurchase(id, async (tx, purchase) => {
      const line = purchase.lines.find((l) => l.id === lineId);
      if (!line || !["PURCHASED", "SHIPPED", "AT_WAREHOUSE"].includes(line.status)) throw new StepError("Возврат — после «Выкуплено»; обновите страницу");
      const cap = lineCost(purchase, line);
      if (refundCny > cap) throw new StepError(`Вернуть можно не больше стоимости строки: ${yuan(cap)}`);
      if (line.order?.status === "FORMED" || line.order?.parcelId) throw new StepError(`Заказ ${line.order.number} уже в посылке — сначала уберите его из посылки`);
      await tx.purchaseLine.update({ where: { id: lineId }, data: { status: "RETURNED", returnKind: kind, returnCostCny, refundCny } });
      if (refundCny > 0) {
        await addLedgerEntry(tx, {
          customerId: purchase.customerId,
          amount: -refundCny,
          reason: "PURCHASE_RETURN",
          note: `Возврат товара по покупке ${purchase.number}, строка ${line.lineNo}${note ? `: ${note}` : ""}`,
          createdById: session.user.id,
          purchaseId: id,
        });
      }
      if (line.order && !["RETURNED", "UTILIZED"].includes(line.order.status)) {
        await tx.order.update({ where: { id: line.order.id }, data: { status: "RETURNED" } });
        await tx.orderStatusHistory.create({
          data: { orderId: line.order.id, status: "RETURNED", changedBy: session.user.id, note: `Возврат по покупке ${purchase.number}` },
        });
        await recordVersion("order", line.order.id, { authorId: session.user.id, comment: `Возврат по покупке ${purchase.number}` }, tx);
      }
      await history(
        tx,
        purchase,
        session.user.id,
        [`Строка ${line.lineNo}: возврат`, kind === "SELLER" ? "за счёт продавца" : "за счёт клиента", `на баланс ${yuan(refundCny)}`, note].filter(Boolean).join(" · "),
        line.lineNo
      );
      return settlePurchase(tx, id, { staffId: session.user.id });
    });
    after(() => notifyPurchaseClient(id, "returned"));
    notifyAfterSettle(id, settled);
  });
}

/** Стоимость строки для клиента: товар + доставка по Китаю + доля комиссии (по доле товара). */
function lineCost(purchase: Purchase, line: PurchaseLine): number {
  const goods = (n(line.unitPriceCny) ?? 0) * line.quantity;
  const totalGoods = n(purchase.goodsCny) ?? 0;
  const commission = n(purchase.commissionCny) ?? 0;
  const share = totalGoods > 0 ? (commission * goods) / totalGoods : 0;
  return round2(goods + (n(line.chinaDeliveryCny) ?? 0) + share);
}

/** Учёт строки: номер заказа у продавца, сколько заплачено продавцу, фото товара (переходит в заказ). */
export async function updateLineNotes(id: string, lineId: string, formData: FormData): Promise<PurchaseActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const paidToSellerCny = parseMoney(formData.get("paidToSellerCny"));
    if (paidToSellerCny != null && paidToSellerCny < 0) throw new StepError("Сумма продавцу не может быть меньше нуля");
    const rawPhoto = text(formData.get("photoUrl"), 300);
    const photoUrl = rawPhoto ? publicPhotoUrl(rawPhoto) : null;
    if (rawPhoto && !photoUrl) throw new StepError("Фото — картинка, загруженная кнопкой «Загрузить»");
    await inPurchase(id, async (tx, purchase) => {
      const line = purchase.lines.find((l) => l.id === lineId);
      if (!line) throw new StepError("Строка не найдена");
      await tx.purchaseLine.update({ where: { id: lineId }, data: { paidToSellerCny, sellerOrderNo: text(formData.get("sellerOrderNo"), 80) || null, photoUrl } });
      if (n(line.paidToSellerCny) !== paidToSellerCny) await history(tx, purchase, session.user.id, `Строка ${line.lineNo}: заплачено продавцу ${yuan(paidToSellerCny)}`, line.lineNo);
    });
    return "Сохранено";
  });
}

/** Внутренний комментарий покупки — видят только сотрудники. */
export async function updatePurchaseNotes(id: string, formData: FormData): Promise<PurchaseActionResult> {
  await requireAdmin();
  return run(id, async () => {
    await prisma.purchase.update({ where: { id }, data: { internalComment: text(formData.get("internalComment"), 2000) || null } });
    return "Сохранено";
  });
}

/** Пометить на удаление (или снять пометку): только пока у покупки нет денег клиента. */
export async function setPurchaseDeleted(id: string, deleted: boolean): Promise<PurchaseActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id } });
      if (!purchase) throw new StepError("Покупка не найдена");
      if (!["NEW", "PRICED", "REJECTED", "CANCELED"].includes(purchase.status) || (await purchasePaidNet(tx, id)) !== 0) {
        throw new StepError("Удалить можно новую, неоплаченную, отклонённую или отменённую покупку без денег клиента");
      }
      await tx.purchase.update({ where: { id }, data: { deletedAt: deleted ? new Date() : null } });
      await history(tx, purchase, session.user.id, deleted ? "Помечена на удаление" : "Пометка удаления снята");
    });
  });
}
