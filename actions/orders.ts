"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildOrderNumber, resolveOrderNumber } from "@/lib/order-number";
import { requireAdmin } from "@/lib/server-helpers";
import { slugify } from "@/lib/utils";

const productSchema = z.object({
  slug: z.string().optional(),
  sku: z.string().trim().optional(),
  customerId: z.string().min(1, "Выберите получателя"),
  deliveryType: z
    .string({
      required_error: "Выберите вид доставки",
      invalid_type_error: "Выберите вид доставки",
    })
    .trim()
    .min(1, "Выберите вид доставки"),
  comments: z.string().trim().optional(),
  description: z.string().optional(),
  isActive: z.coerce.boolean().default(true),
});

const trackItemSchema = z.object({
  trackNumber: z.string().trim().min(1, "Трек номер обязателен"),
  name: z.string().trim().min(1, "Наименование обязательно"),
  quantity: z.coerce.number().int().min(1, "Количество должно быть больше 0"),
  unitPrice: z.coerce.number().positive("Стоимость за единицу должна быть больше 0"),
  productUrl: z.string().trim().optional(),
  photoReport: z.boolean().optional().default(false),
  photoReportUrl: z.string().trim().optional(),
});

const trackItemsSchema = z.array(trackItemSchema).min(1, "Добавьте хотя бы одну строку");

type TrackItemInput = z.infer<typeof trackItemSchema>;

function productPayloadFromFormData(formData: FormData) {
  const isActiveValue = formData.get("isActive");

  return {
    ...Object.fromEntries(formData),
    isActive: isActiveValue === null ? true : isActiveValue === "on",
  };
}

function parseTrackItems(formData: FormData): {
  trackItems?: TrackItemInput[];
  error?: Record<string, string[]>;
} {
  const rawTrackItems = formData.get("trackItems");

  if (typeof rawTrackItems !== "string") {
    return { error: { trackItems: ["Добавьте хотя бы одну строку"] } };
  }

  try {
    const parsed = trackItemsSchema.safeParse(JSON.parse(rawTrackItems));

    if (!parsed.success) {
      return {
        error: { trackItems: [parsed.error.issues[0]?.message ?? "Проверьте строки треков"] },
      };
    }

    return { trackItems: parsed.data };
  } catch {
    return { error: { trackItems: ["Проверьте строки треков"] } };
  }
}

async function isSkuTaken(sku: string, excludeId?: string): Promise<boolean> {
  const existing = await prisma.order.findFirst({
    where: {
      sku,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function ensureUniqueSlugInTx(
  tx: Prisma.TransactionClient,
  base: string,
  reserved: Set<string>,
  excludeId?: string
): Promise<string> {
  const seed = base.trim() || `product-${Date.now()}`;

  for (let suffix = 0; suffix < 1000; suffix++) {
    const candidate = suffix === 0 ? seed : `${seed}-${suffix + 1}`;
    if (reserved.has(candidate)) continue;

    const existing = await tx.order.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      reserved.add(candidate);
      return candidate;
    }
  }

  const fallback = `${seed}-${Date.now()}`;
  reserved.add(fallback);
  return fallback;
}

async function validateCustomer(customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null },
    select: { id: true },
  });

  if (!customer) {
    return { customerId: ["Выберите существующего получателя"] };
  }

  return null;
}

export async function createOrder(formData: FormData) {
  await requireAdmin();

  const parsed = productSchema.safeParse(productPayloadFromFormData(formData));
  const trackItemsResult = parseTrackItems(formData);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  if (trackItemsResult.error || !trackItemsResult.trackItems) {
    return { error: trackItemsResult.error };
  }

  const trackItems = trackItemsResult.trackItems;
  const { customerId, deliveryType, comments, description, isActive } = parsed.data;
  const customerError = await validateCustomer(customerId);

  if (customerError) {
    return { error: customerError };
  }

  const resolved = await resolveOrderNumber(customerId);
  if (!resolved.ok) {
    if (!resolved.recipient) {
      return { error: { customerId: ["Получатель не найден"] } };
    }
    return {
      error: {
        customerId: [
          `У получателя не заполнены: ${resolved.missing.join(", ")}. Откройте карточку получателя для дозаполнения.`,
        ],
      },
      missingRecipientFields: {
        customerId: resolved.recipient.id,
        missing: resolved.missing,
      },
    };
  }

  const { clientCode, countryCode, routeNumber: baseSerial } = resolved.parts;
  const targetSkus = trackItems.map((_, i) =>
    buildOrderNumber(clientCode, baseSerial + i, countryCode)
  );

  const taken = await prisma.order.findMany({
    where: { sku: { in: targetSkus } },
    select: { sku: true },
  });
  if (taken.length > 0) {
    return {
      error: {
        trackItems: [
          `Номера уже заняты: ${taken.map((t) => t.sku).join(", ")}. Повторите.`,
        ],
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    const reservedSlugs = new Set<string>();
    for (let i = 0; i < trackItems.length; i++) {
      const item = trackItems[i];
      const orderSku = targetSkus[i];
      const baseSlug = slugify(item.trackNumber) || `order-${orderSku.toLowerCase()}`;
      const orderSlug = await ensureUniqueSlugInTx(tx, baseSlug, reservedSlugs);

      const order = await tx.order.create({
        data: {
          name: item.trackNumber,
          slug: orderSlug,
          sku: orderSku,
          customerId,
          deliveryType,
          comments: comments || null,
          description: i === 0 ? description ?? null : null,
          price: item.quantity * item.unitPrice,
          stock: item.quantity,
          isActive,
          imageUrl: null,
        },
        select: { id: true },
      });

      await tx.orderTrackItem.create({
        data: {
          productId: order.id,
          trackNumber: item.trackNumber,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          productUrl: item.productUrl?.trim() || null,
          imageUrl: null,
          photoReport: item.photoReport,
          photoReportUrl: item.photoReportUrl?.trim() || null,
        },
      });
    }
  });

  revalidatePath("/orders");
  redirect("/orders");
}

export async function updateOrder(id: string, formData: FormData) {
  await requireAdmin();

  const parsed = productSchema.safeParse(productPayloadFromFormData(formData));
  const trackItemsResult = parseTrackItems(formData);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  if (trackItemsResult.error || !trackItemsResult.trackItems) {
    return { error: trackItemsResult.error };
  }

  const trackItems = trackItemsResult.trackItems;

  if (trackItems.length !== 1) {
    return {
      error: {
        trackItems: ["В одном заказе должен быть ровно один трек. Уберите лишние строки."],
      },
    };
  }

  const trackItem = trackItems[0];
  const { slug, sku, customerId, deliveryType, comments, description, isActive } = parsed.data;
  const customerError = await validateCustomer(customerId);

  if (customerError) {
    return { error: customerError };
  }

  const currentProduct = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    select: { sku: true },
  });

  if (!currentProduct) {
    return { error: { sku: ["Заказ не найден"] } };
  }

  const trimmedSku = sku?.trim();
  if (trimmedSku && trimmedSku !== currentProduct.sku && (await isSkuTaken(trimmedSku, id))) {
    return { error: { sku: ["Такой номер уже занят"] } };
  }

  const finalSku = trimmedSku || currentProduct.sku;
  const name = trackItem.trackNumber;

  await prisma.$transaction(async (tx) => {
    const reservedSlugs = new Set<string>();
    const finalSlug = await ensureUniqueSlugInTx(
      tx,
      slug?.trim() || slugify(name),
      reservedSlugs,
      id
    );

    await tx.order.update({
      where: { id },
      data: {
        name,
        slug: finalSlug,
        sku: finalSku,
        customerId,
        deliveryType,
        comments: comments || null,
        description,
        price: trackItem.quantity * trackItem.unitPrice,
        stock: trackItem.quantity,
        isActive,
        imageUrl: null,
      },
    });

    await tx.orderTrackItem.deleteMany({ where: { productId: id } });
    await tx.orderTrackItem.create({
      data: {
        productId: id,
        trackNumber: trackItem.trackNumber,
        name: trackItem.name,
        quantity: trackItem.quantity,
        unitPrice: trackItem.unitPrice,
        totalPrice: trackItem.quantity * trackItem.unitPrice,
        productUrl: trackItem.productUrl?.trim() || null,
        imageUrl: null,
        photoReport: trackItem.photoReport,
        photoReportUrl: trackItem.photoReportUrl?.trim() || null,
      },
    });
  });

  revalidatePath(`/orders/${id}/edit`);
  revalidatePath("/orders");
  redirect("/orders");
}

export async function archiveOrder(id: string) {
  await requireAdmin();

  await prisma.order.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath("/orders");
}

export async function deleteOrder(id: string) {
  await requireAdmin();

  const hasOrders = await prisma.parcelItem.findFirst({
    where: { productId: id },
  });

  if (hasOrders) {
    return {
      error: "Нельзя удалить заказ, который уже используется в посылках. Используйте архивирование.",
    };
  }

  await prisma.order.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/orders");
  redirect("/orders");
}
