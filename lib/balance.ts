import "server-only";

import type { LedgerReason, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextDocumentNumber } from "@/lib/document-numbers";
import { round2 } from "@/lib/buyout-money";

// Баланс клиента — его деньги у нас, в юанях.
// Источник — регистр «Изменение долга клиента» (ClientLedger, DK-…): amount > 0 — долг вырос (списали с баланса),
// amount < 0 — долг уменьшился (зачислили на баланс). Баланс = минус сумма строк в юанях.
// Записи только добавляются: ошибку исправляет обратная запись (сторно), удалять нельзя (будущее.md, раздел 8).
//
// Кто пишет: зачисление пополнения (TOP_UP, минус), оплата выкупа (BUYOUT_PAYMENT, плюс),
// возврат за выкуп (BUYOUT_REFUND, минус). Начисления за посылки (PARCEL_CHARGE) — когда до них дойдёт чат «админка»:
// тогда неоплаченная посылка уменьшит баланс, а распределение уже зачисленного прихода второй строки писать не должно.

type Db = PrismaClient | Prisma.TransactionClient;

export async function clientBalance(customerId: string, db: Db = prisma): Promise<number> {
  const sum = await db.clientLedger.aggregate({
    where: { customerId, currency: "CNY", deletedAt: null },
    _sum: { amount: true },
  });
  return round2(-Number(sum._sum.amount ?? 0));
}

/**
 * Деньги клиента заняты до конца транзакции: второе списание или зачисление того же клиента ждёт первое.
 * Так два одновременных списания не пройдут оба мимо проверки баланса.
 */
export async function lockClientMoney(tx: Prisma.TransactionClient, customerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`balance:${customerId}`}))`;
}

/** Номер платежа для сверки: без пробелов, заглавными. */
export function paymentReference(value: string | null | undefined): string | null {
  const ref = (value ?? "").replace(/\s+/g, "").toUpperCase();
  return ref || null;
}

/** Один номер платежа зачисляется один раз: блокировка по номеру до конца транзакции и проверка прихода с ним. */
export async function paymentReferenceUsed(tx: Prisma.TransactionClient, reference: string): Promise<boolean> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-ref:${reference}`}))`;
  const used = await tx.payment.findFirst({ where: { reference, deletedAt: null }, select: { id: true } });
  return Boolean(used);
}

export async function addLedgerEntry(
  tx: Prisma.TransactionClient,
  entry: {
    customerId: string;
    amount: number; // + списали с баланса, − зачислили
    reason: LedgerReason;
    note: string;
    createdById: string | null;
    buyoutId?: string;
    paymentId?: string;
  }
) {
  return tx.clientLedger.create({
    data: {
      number: await nextDocumentNumber(tx, "clientLedger"),
      customerId: entry.customerId,
      amount: round2(entry.amount),
      currency: "CNY",
      reason: entry.reason,
      note: entry.note,
      createdById: entry.createdById,
      buyoutId: entry.buyoutId ?? null,
      paymentId: entry.paymentId ?? null,
    },
  });
}

export const LEDGER_REASON_LABELS: Record<LedgerReason, string> = {
  PARCEL_CHARGE: "Начисление за посылку",
  PAYMENT: "Оплата",
  ADJUSTMENT: "Корректировка",
  TOP_UP: "Пополнение баланса",
  BUYOUT_PAYMENT: "Оплата выкупа",
  BUYOUT_REFUND: "Возврат за выкуп",
};

export type BalanceMove = { id: string; number: string; date: Date; reason: LedgerReason; label: string; amount: number; note: string | null };

/** Движения баланса клиента, новые первыми: amount > 0 — пришло на баланс, < 0 — списано. */
export async function balanceMoves(customerId: string, take = 50): Promise<BalanceMove[]> {
  const rows = await prisma.clientLedger.findMany({
    where: { customerId, currency: "CNY", deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { number: "desc" }],
    take,
  });
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    date: row.createdAt,
    reason: row.reason,
    label: LEDGER_REASON_LABELS[row.reason] ?? row.reason,
    amount: round2(-Number(row.amount)),
    note: row.note,
  }));
}
