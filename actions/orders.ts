"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";

const schema = z.object({
  customerId: z.string().min(1, "Выберите клиента"),
  recipientId: z.string().optional(),
  deliveryType: z.enum(["AUTO", "AIR", "SEA", "EMS"]).optional(),
  productNameText: z.string().trim().min(1, "Укажите наименование"),
  trackNumber: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1),
  unitPriceUsd: z.coerce.number().min(0).optional(),
  actualWeightKg: z.coerce.number().min(0).optional(),
  detailedCheckRequested: z.boolean().optional(),
});

export async function updateOrder(id: string, formData: FormData): Promise<void> {
  await requireAdmin();

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const data = schema.parse({
    ...raw,
    detailedCheckRequested: raw.detailedCheckRequested === "on",
  });

  const unit = data.unitPriceUsd ?? 0;
  const declaredValueUsd = unit * data.quantity;

  await prisma.order.update({
    where: { id },
    data: {
      customerId: data.customerId,
      recipientId: data.recipientId || null,
      deliveryType: data.deliveryType ?? null,
      productNameText: data.productNameText,
      trackNumber: data.trackNumber || null,
      quantity: data.quantity,
      unitPriceUsd: data.unitPriceUsd ?? null,
      declaredValueUsd: data.unitPriceUsd ? declaredValueUsd : null,
      actualWeightKg: data.actualWeightKg ?? null,
      detailedCheckRequested: !!data.detailedCheckRequested,
    },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}/edit`);
  redirect("/orders");
}

export async function deleteOrder(id: string): Promise<{ error?: string } | void> {
  await requireAdmin();

  const order = await prisma.order.findUnique({
    where: { id },
    select: { parcelId: true },
  });

  if (order?.parcelId) {
    return {
      error: "Нельзя удалить заказ, уже оформленный в посылку. Сначала расформируйте посылку.",
    };
  }

  await prisma.order.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/orders");
}
