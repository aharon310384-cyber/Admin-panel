"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { parseOrdersFromText, type ParsedOrderDraft } from "@/lib/ai-order-parser";

export type ParseOrdersResponse =
  | { ok: true; orders: ParsedOrderDraft[] }
  | { ok: false; error: string };

/** Разобрать свободный текст в черновики заказов (ИИ, OpenRouter). */
export async function parseOrderText(text: string): Promise<ParseOrdersResponse> {
  await requireAdmin();
  return parseOrdersFromText(text);
}

const draftSchema = z.object({
  productNameText: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  unitPriceUsd: z.coerce.number().min(0).nullable().optional(),
  trackNumber: z.string().trim().nullable().optional(),
  deliveryType: z.enum(["AUTO", "AIR", "SEA", "EMS"]).nullable().optional(),
});

const bulkSchema = z.object({
  customerId: z.string().min(1, "Выберите клиента"),
  recipientId: z.string().optional().nullable(),
  deliveryType: z.enum(["AUTO", "AIR", "SEA", "EMS"]).optional().nullable(),
  orders: z.array(draftSchema).min(1, "Нет заказов для создания"),
});

export type CreateOrdersBulkInput = z.input<typeof bulkSchema>;

export type CreateOrdersBulkResponse =
  | { ok: true; created: number }
  | { ok: false; error: string };

/** Массовое создание заказов из разобранных черновиков. */
export async function createOrdersBulk(
  input: CreateOrdersBulkInput,
): Promise<CreateOrdersBulkResponse> {
  await requireAdmin();

  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, deletedAt: null },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Клиент не найден" };

  let created = 0;
  for (const draft of data.orders) {
    const unit = draft.unitPriceUsd ?? 0;
    const declaredValueUsd = unit * draft.quantity;

    // Связка со справочником по точному совпадению наименования (RU)
    const match = await prisma.productName.findFirst({
      where: { deletedAt: null, nameRu: draft.productNameText },
      select: { id: true, nameRu: true, category: true, hsCode: true },
    });

    await prisma.order.create({
      data: {
        customerId: data.customerId,
        recipientId: data.recipientId || null,
        deliveryType: draft.deliveryType ?? data.deliveryType ?? null,
        productNameId: match?.id ?? null,
        productNameText: match?.nameRu ?? draft.productNameText,
        category: match?.category ?? null,
        hsCode: match?.hsCode ?? null,
        trackNumber: draft.trackNumber || null,
        quantity: draft.quantity,
        unitPriceUsd: draft.unitPriceUsd ?? null,
        declaredValueUsd: draft.unitPriceUsd != null ? declaredValueUsd : null,
        status: "NEW",
      },
    });
    created += 1;
  }

  revalidatePath("/orders");
  return { ok: true, created };
}
