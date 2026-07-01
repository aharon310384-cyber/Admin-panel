"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { resolveProductCatalog } from "@/lib/products";

const schema = z.object({
  customerId: z.string().min(1, "Выберите клиента"),
  recipientId: z.string().optional(),
  deliveryType: z.enum(["AUTO", "AIR", "SEA", "EMS"]).optional(),
  productNameId: z.string().optional(),
  productNameText: z.string().trim().min(1, "Укажите наименование"),
  trackNumber: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1),
  unitPriceUsd: z.coerce.number().min(0).optional(),
  actualWeightKg: z.coerce.number().min(0).optional(),
  detailedCheckRequested: z.boolean().optional(),
  keepOriginalPackaging: z.boolean().optional(),
});

export async function createOrder(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session) redirect("/login");

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const data = schema.parse({
    ...raw,
    detailedCheckRequested: raw.detailedCheckRequested === "on",
    keepOriginalPackaging: raw.keepOriginalPackaging === "on",
  });

  const unit = data.unitPriceUsd ?? 0;
  const declaredValueUsd = unit * data.quantity;
  const catalog = await resolveProductCatalog(data.productNameId);

  await prisma.order.create({
    data: {
      customerId: data.customerId,
      recipientId: data.recipientId || null,
      deliveryType: data.deliveryType ?? null,
      productNameId: catalog?.id ?? null,
      productNameText: catalog?.nameRu ?? data.productNameText,
      category: catalog?.category ?? null,
      hsCode: catalog?.hsCode ?? null,
      trackNumber: data.trackNumber || null,
      quantity: data.quantity,
      unitPriceUsd: data.unitPriceUsd ?? null,
      declaredValueUsd: data.unitPriceUsd ? declaredValueUsd : null,
      actualWeightKg: data.actualWeightKg ?? null,
      detailedCheckRequested: !!data.detailedCheckRequested,
      keepOriginalPackaging: !!data.keepOriginalPackaging,
      status: "NEW",
      authorId: session.user.id,
    },
  });

  revalidatePath("/orders");
  redirect("/orders");
}
