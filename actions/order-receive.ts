"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/** Приём заказа на склад: статус RECEIVED (или с несоответствием) + фактический вес. */
export async function receiveOrder(
  orderId: string,
  weightKg: number | null,
  discrepancy: boolean
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Не авторизован" };

  const status = discrepancy ? "RECEIVED_WITH_DISCREPANCY" : "RECEIVED";

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
      note: discrepancy ? "Принят с несоответствием" : "Принят на склад",
    },
  });

  revalidatePath("/receiving");
  return { ok: true };
}
