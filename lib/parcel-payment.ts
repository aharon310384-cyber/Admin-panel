import type { Prisma, PrismaClient } from "@prisma/client";
import { ensureBaseline, recordVersion } from "@/lib/versions";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Отмечает посылку оплаченной, когда распределённые на неё оплаты (документы
 * «Распределение оплат по посылкам») покрывают итог квитанции.
 * Суммы в долларах пересчитываются в юани по курсу посылки.
 *
 * Отметка только ставится, но не снимается: ручная галочка администратора
 * (setParcelPaid) остаётся для исправлений, и её нельзя отличить от автоматической.
 * Вызывать после создания или изменения распределения, в той же транзакции.
 * Возвращает true, если посылка только что стала оплаченной (для уведомления клиента).
 * authorId — сотрудник, который провёл распределение (для «Истории изменений» посылки).
 */
export async function markParcelPaidIfCovered(db: Db, parcelId: string, authorId: string | null = null): Promise<boolean> {
  const parcel = await db.parcel.findUnique({
    where: { id: parcelId },
    select: { isPaid: true, totalCny: true, exchangeRateCnyPerUsd: true },
  });
  if (!parcel || parcel.isPaid) return false;

  const totalCny = Number(parcel.totalCny);
  if (totalCny <= 0) return false;

  const items = await db.paymentAllocationItem.findMany({
    where: {
      parcelId,
      allocation: { deletedAt: null, payment: { deletedAt: null } },
    },
    select: {
      amount: true,
      allocation: { select: { payment: { select: { currency: true, receivedAt: true } } } },
    },
  });

  const rate = Number(parcel.exchangeRateCnyPerUsd);
  let coveredCny = 0;
  let lastReceivedAt: Date | null = null;
  for (const item of items) {
    const { currency, receivedAt } = item.allocation.payment;
    coveredCny += currency === "USD" ? Number(item.amount) * rate : Number(item.amount);
    if (!lastReceivedAt || receivedAt > lastReceivedAt) lastReceivedAt = receivedAt;
  }

  // Допуск в полфэня на округления.
  if (coveredCny + 0.005 < totalCny) return false;

  await ensureBaseline("parcel", parcelId, db);
  await db.parcel.update({
    where: { id: parcelId },
    data: { isPaid: true, paidAt: lastReceivedAt ?? new Date() },
  });
  await recordVersion("parcel", parcelId, { authorId, comment: "Оплачена по распределению оплат" }, db);
  return true;
}
