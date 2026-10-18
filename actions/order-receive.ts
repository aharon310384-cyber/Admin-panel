"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ensureBaseline, recordVersion } from "@/lib/versions";

/** Приём заказа на склад: статус RECEIVED (или с несоответствием) + фактический вес. */
export async function receiveOrder(
  orderId: string,
  weightKg: number | null,
  discrepancy: boolean
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Не авторизован" };

  const status = discrepancy ? "RECEIVED_WITH_DISCREPANCY" : "RECEIVED";
  const note = discrepancy ? "Принят с несоответствием" : "Принят на склад";

  await ensureBaseline("order", orderId);
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(weightKg != null ? { actualWeightKg: weightKg } : {}),
    },
  });
  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status,
      changedBy: session.user.id,
      note,
    },
  });
  await recordVersion("order", orderId, { authorId: session.user.id, comment: note });

  revalidatePath("/receiving");
  return { ok: true };
}
