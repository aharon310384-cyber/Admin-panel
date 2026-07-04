"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { parseOrdersFromText, type ParsedOrderDraft } from "@/lib/ai-order-parser";

export type ParseOrdersResponse =
  | { ok: true; orders: ParsedOrderDraft[] }
  | { ok: false; error: string; detail?: string };

/** Разобрать свободный текст в черновики заказов (ИИ, OpenRouter). */
export async function parseOrderText(text: string): Promise<ParseOrdersResponse> {
  await requireAdmin();

  // Справочник наименований — модель нормализует товары к каноничным названиям.
  const catalog = await prisma.productName.findMany({
    where: { deletedAt: null },
    select: { nameRu: true },
    orderBy: { nameRu: "asc" },
    take: 400,
  });

  return parseOrdersFromText(text, catalog.map((c) => c.nameRu));
}

const draftSchema = z.object({
  productNameText: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  unitPriceUsd: z.coerce.number().min(0).nullable().optional(),
  unitPriceCny: z.coerce.number().min(0).nullable().optional(),
  trackNumber: z.string().trim().nullable().optional(),
  detailedCheckRequested: z.boolean().optional(),
  keepOriginalPackaging: z.boolean().optional(),
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
  const session = await requireAdmin();

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

  // Получатель должен принадлежать выбранному клиенту.
  let recipientId: string | null = null;
  if (data.recipientId) {
    const recipient = await prisma.recipient.findFirst({
      where: { id: data.recipientId, customerId: data.customerId, deletedAt: null },
      select: { id: true },
    });
    recipientId = recipient?.id ?? null;
  }

  // Автор пишется, только если пользователь реально есть в БД:
  // сессия может ссылаться на устаревший User.id (например, после пересева базы).
  const author = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  const authorId = author?.id ?? null;

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
        recipientId,
        deliveryType: data.deliveryType ?? null,
        productNameId: match?.id ?? null,
        productNameText: match?.nameRu ?? draft.productNameText,
        category: match?.category ?? null,
        hsCode: match?.hsCode ?? null,
        trackNumber: draft.trackNumber || null,
        quantity: draft.quantity,
        unitPriceCny: draft.unitPriceCny ?? null,
        unitPriceUsd: draft.unitPriceUsd ?? null,
        declaredValueUsd: draft.unitPriceUsd != null ? declaredValueUsd : null,
        detailedCheckRequested: draft.detailedCheckRequested ?? false,
        keepOriginalPackaging: draft.keepOriginalPackaging ?? true,
        status: "NEW",
        authorId,
      },
    });
    created += 1;
  }

  revalidatePath("/orders");
  return { ok: true, created };
}

const quickRecipientSchema = z.object({
  customerId: z.string().min(1, "Выберите клиента"),
  name: z.string().trim().min(1, "Укажите имя получателя"),
  country: z.string().trim().optional().nullable(),
});

export type QuickRecipientInput = z.input<typeof quickRecipientSchema>;
export type QuickRecipientResponse =
  | { ok: true; recipient: { id: string; customerId: string; name: string; country: string | null } }
  | { ok: false; error: string };

/** Быстрое создание получателя из формы заказа (на подтверждение). */
export async function createRecipientQuick(
  input: QuickRecipientInput,
): Promise<QuickRecipientResponse> {
  await requireAdmin();

  const parsed = quickRecipientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, deletedAt: null },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Клиент не найден" };

  const recipient = await prisma.recipient.create({
    data: {
      customerId: data.customerId,
      name: data.name,
      country: data.country || null,
    },
    select: { id: true, customerId: true, name: true, country: true },
  });

  revalidatePath("/orders");
  return { ok: true, recipient };
}
