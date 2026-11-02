import "server-only";

import { after } from "next/server";
import type { BuyoutStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyBuyoutClient } from "@/lib/buyout-notify";

// Выкуп товара за клиента (docs/product/задание-выкуп.md): настройки компании, переходы статусов, «На складе».

/** Чьи выкупы: компания клиентов (её бренд — в кабинете). Компаний ещё нет — null. */
export async function buyoutCompanyId(): Promise<string | null> {
  const company = await prisma.company.findFirst({ where: { cabinetBrand: true }, select: { id: true }, orderBy: { createdAt: "asc" } });
  return company?.id ?? null;
}

export type BuyoutSettingsView = {
  id: string | null;
  companyId: string | null;
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

/** Настройки выкупа компании клиентов; нет своих — общие (без компании); нет и их — пустые. */
export async function getBuyoutSettings(): Promise<BuyoutSettingsView> {
  const companyId = await buyoutCompanyId();
  const settings =
    (companyId ? await prisma.buyoutSettings.findUnique({ where: { companyId } }) : null) ??
    (await prisma.buyoutSettings.findFirst({ where: { companyId: null } }));
  return {
    id: settings?.id ?? null,
    companyId: settings?.companyId ?? companyId,
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

export const COMMISSION_MISSING = "Не задан процент комиссии — задайте его в «Выкуп → Настройки выкупа».";

/** Где деньги клиента уже списаны: отказ и возврат кладут их обратно на баланс. */
export const PAID_STATUSES: BuyoutStatus[] = ["PAID", "PURCHASED", "SHIPPED", "AT_WAREHOUSE"];
/** Выкуп закрыт — кнопок больше нет. */
export const FINAL_STATUSES: BuyoutStatus[] = ["REJECTED", "CANCELED", "RETURNED"];
/** Заказ из выкупа принят складом — у выкупа «На складе». */
const ORDER_AT_WAREHOUSE = ["RECEIVED", "RECEIVED_WITH_DISCREPANCY", "FORMED"] as const;

/**
 * «На складе»: у выкупов «Отправлена продавцом», чей заказ склад уже принял, — статус «На складе» и сообщение клиенту.
 * Приём на склад (actions/order-receive.ts) сейчас переделывает чат «админка», поэтому статус подтягивается, когда
 * открывают журнал выкупов, карточку или выкупы в кабинете. Повторный вызов ничего не меняет.
 */
export async function syncBuyoutsAtWarehouse(where: { customerId?: string; id?: string } = {}): Promise<number> {
  const ready = await prisma.buyout.findMany({
    where: { ...where, status: "SHIPPED", deletedAt: null, order: { status: { in: [...ORDER_AT_WAREHOUSE] } } },
    select: { id: true },
  });
  let changed = 0;
  for (const { id } of ready) {
    const moved = await prisma.$transaction(async (tx) => {
      const updated = await tx.buyout.updateMany({ where: { id, status: "SHIPPED" }, data: { status: "AT_WAREHOUSE" } });
      if (updated.count) {
        await tx.buyoutStatusHistory.create({ data: { buyoutId: id, status: "AT_WAREHOUSE", note: "Заказ принят на склад" } });
      }
      return updated.count > 0;
    });
    if (moved) {
      changed += 1;
      after(() => notifyBuyoutClient(id, "at-warehouse"));
    }
  }
  return changed;
}
