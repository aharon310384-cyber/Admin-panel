"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { nextDocumentNumber } from "@/lib/document-numbers";
import { ensureBaselines, recordVersions } from "@/lib/versions";

export type ReceiveResult = { ok: true; number: string; count: number } | { ok: false; error: string };

const WAITING: OrderStatus[] = ["NEW", "IN_RECEIVING_QUEUE"];
const trackKey = (track: string | null) => (track ?? "").trim().toUpperCase();

/** Вес коробки поровну между товарами до сотых: лишние копейки веса — первым, сумма равна весу коробки. */
function splitWeight(weightKg: number, count: number): number[] {
  const total = Math.round(weightKg * 100);
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => (base + (i < total - base * count ? 1 : 0)) / 100);
}

/**
 * Приём коробки на склад (владелец 2026-11-02, вариант А — «Заказ = товар»): отмеченные заказы одного входящего
 * трека — одним действием и одним весом коробки. Создаётся документ «Приём заказа» (PR-…) с треком и весом,
 * заказы — «Принят на склад» (или с несоответствием) со ссылкой на него. Вес делится между заказами поровну,
 * чтобы вес посылки (сумма весов заказов) был равен весу коробки; поправить — в карточке заказа.
 * Без веса вес заказов не меняется. Заказ без трека — своя коробка из одного товара.
 */
export async function receiveBox(orderIds: string[], weightKg: number | null, discrepancy: boolean): Promise<ReceiveResult> {
  const session = await auth();
  if (!session) return { ok: false, error: "Не авторизован" };
  const author = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!author) return { ok: false, error: "Пользователь не найден — войдите заново" };

  const ids = [...new Set(orderIds)];
  if (!ids.length) return { ok: false, error: "Отметьте товары коробки" };
  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, deletedAt: null, status: { in: WAITING } },
    select: { id: true, trackNumber: true },
    orderBy: [{ createdAt: "asc" }, { number: "asc" }],
  });
  if (orders.length !== ids.length) return { ok: false, error: "Часть товаров уже принята или удалена — обновите страницу" };
  const track = trackKey(orders[0].trackNumber);
  if (orders.some((o) => trackKey(o.trackNumber) !== track)) return { ok: false, error: "В одной коробке — товары одного входящего трека" };
  if (!track && orders.length > 1) return { ok: false, error: "Товары без трека принимаются по одному" };

  const weight = weightKg != null && Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 100) / 100 : null;
  const shares = weight != null ? splitWeight(weight, orders.length) : null;
  const status: OrderStatus = discrepancy ? "RECEIVED_WITH_DISCREPANCY" : "RECEIVED";

  const receiving = await prisma.$transaction(async (tx) => {
    const doc = await tx.receiving.create({
      data: {
        number: await nextDocumentNumber(tx, "receiving"),
        trackNumber: orders[0].trackNumber?.trim() || null,
        weightKg: weight,
        note: discrepancy ? "Принят с несоответствием" : null,
        createdById: author.id,
      },
      select: { id: true, number: true },
    });
    const note = `${discrepancy ? "Принят с несоответствием" : "Принят на склад"} · ${doc.number}`;
    await ensureBaselines("order", ids, tx);
    for (const [i, order] of orders.entries()) {
      await tx.order.update({
        where: { id: order.id },
        data: { status, receivingId: doc.id, ...(shares ? { actualWeightKg: shares[i] } : {}) },
      });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, status, changedBy: author.id, note } });
    }
    await recordVersions("order", ids, { authorId: author.id, comment: note }, tx);
    return doc;
  });

  revalidatePath("/receiving");
  revalidatePath("/orders");
  return { ok: true, number: receiving.number, count: orders.length };
}
