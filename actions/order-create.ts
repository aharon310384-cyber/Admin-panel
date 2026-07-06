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
  customerComment: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1),
  unitPriceUsd: z.coerce.number().min(0).optional(),
  actualWeightKg: z.coerce.number().min(0).optional(),
  detailedCheckRequested: z.boolean().optional(),
  keepOriginalPackaging: z.boolean().optional(),
  consolidationRequested: z.boolean().optional(),
  compactPackRequested: z.boolean().optional(),
  standardCheckRequested: z.boolean().optional(),
  reinforcedPackRequested: z.boolean().optional(),
});

export async function createOrder(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session) redirect("/login");

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const data = schema.parse({
    ...raw,
    detailedCheckRequested: raw.detailedCheckRequested === "on",
    keepOriginalPackaging: raw.keepOriginalPackaging === "on",
    consolidationRequested: raw.consolidationRequested === "on",
    compactPackRequested: raw.compactPackRequested === "on",
    standardCheckRequested: raw.standardCheckRequested === "on",
    reinforcedPackRequested: raw.reinforcedPackRequested === "on",
  });

  const unit = data.unitPriceUsd ?? 0;
  const declaredValueUsd = unit * data.quantity;
  const catalog = await resolveProductCatalog(data.productNameId);

  // Автор пишется, только если пользователь реально есть в БД:
  // сессия может ссылаться на устаревший User.id (например, после пересева базы).
  const author = session.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })
    : null;

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
      customerComment: data.customerComment || null,
      quantity: data.quantity,
      unitPriceUsd: data.unitPriceUsd ?? null,
      declaredValueUsd: data.unitPriceUsd ? declaredValueUsd : null,
      actualWeightKg: data.actualWeightKg ?? null,
      detailedCheckRequested: !!data.detailedCheckRequested,
      keepOriginalPackaging: !!data.keepOriginalPackaging,
      consolidationRequested: !!data.consolidationRequested,
      compactPackRequested: !!data.compactPackRequested,
      standardCheckRequested: !!data.standardCheckRequested,
      reinforcedPackRequested: !!data.reinforcedPackRequested,
      status: "NEW",
      authorId: author?.id ?? null,
    },
  });

  revalidatePath("/orders");
  redirect("/orders");
}
