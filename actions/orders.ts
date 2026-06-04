"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveOrderNumber } from "@/lib/order-number";
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

function trackItemsSummary(trackItems: TrackItemInput[]) {
  return trackItems.reduce(
    (summary, item) => ({
      trackNumbers: [...summary.trackNumbers, item.trackNumber],
      quantity: summary.quantity + item.quantity,
      totalPrice: summary.totalPrice + item.quantity * item.unitPrice,
    }),
    { trackNumbers: [] as string[], quantity: 0, totalPrice: 0 }
  );
}

function trackItemCreateData(productId: string, trackItems: TrackItemInput[]) {
  return trackItems.map((item) => ({
    productId,
    trackNumber: item.trackNumber,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.quantity * item.unitPrice,
    productUrl: item.productUrl?.trim() || null,
    imageUrl: null,
    photoReport: item.photoReport,
    photoReportUrl: item.photoReportUrl?.trim() || null,
  }));
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

type SkuResolution =
  | { ok: true; sku: string }
  | { ok: false; error: Record<string, string[]>; missingRecipientFields?: { customerId: string; missing: string[] } };

async function resolveOrderSkuForCreate(
  manualSku: string | undefined,
  customerId: string
): Promise<SkuResolution> {
  const trimmed = manualSku?.trim();

  if (trimmed) {
    if (await isSkuTaken(trimmed)) {
      return { ok: false, error: { sku: ["Такой номер уже занят"] } };
    }
    return { ok: true, sku: trimmed };
  }

  const resolved = await resolveOrderNumber(customerId);

  if (!resolved.ok) {
    if (!resolved.recipient) {
      return { ok: false, error: { customerId: ["Получатель не найден"] } };
    }
    return {
      ok: false,
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

  if (await isSkuTaken(resolved.parts.number)) {
    return { ok: false, error: { sku: [`Номер ${resolved.parts.number} уже занят, повторите попытку`] } };
  }

  return { ok: true, sku: resolved.parts.number };
}

async function ensureUniqueSlug(
  base: string,
  excludeId?: string
): Promise<string> {
  const trimmed = base.trim();
  const seed = trimmed || `product-${Date.now()}`;

  for (let suffix = 0; suffix < 1000; suffix++) {
    const candidate = suffix === 0 ? seed : `${seed}-${suffix + 1}`;
    const existing = await prisma.order.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `${seed}-${Date.now()}`;
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
  const { slug, sku, customerId, deliveryType, comments, description, isActive } = parsed.data;
  const customerError = await validateCustomer(customerId);

  if (customerError) {
    return { error: customerError };
  }

  const skuResolution = await resolveOrderSkuForCreate(sku, customerId);
  if (!skuResolution.ok) {
    return skuResolution.missingRecipientFields
      ? { error: skuResolution.error, missingRecipientFields: skuResolution.missingRecipientFields }
      : { error: skuResolution.error };
  }

  const summary = trackItemsSummary(trackItems);
  const name = summary.trackNumbers.join("\n");
  const finalSlug = await ensureUniqueSlug(slug?.trim() || slugify(name));
  const finalSku = skuResolution.sku;

  await prisma.$transaction(async (tx) => {
    const product = await tx.order.create({
      data: {
        name,
        slug: finalSlug,
        sku: finalSku,
        customerId,
        deliveryType,
        comments: comments || null,
        description,
        price: summary.totalPrice,
        stock: summary.quantity,
        isActive,
        imageUrl: null,
      },
      select: { id: true },
    });

    await tx.orderTrackItem.createMany({
      data: trackItemCreateData(product.id, trackItems),
    });
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

  const summary = trackItemsSummary(trackItems);
  const name = summary.trackNumbers.join("\n");
  const finalSlug = await ensureUniqueSlug(slug?.trim() || slugify(name), id);
  const finalSku = trimmedSku || currentProduct.sku;

  await prisma.$transaction(async (tx) => {
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
        price: summary.totalPrice,
        stock: summary.quantity,
        isActive,
        imageUrl: null,
      },
    });

    await tx.orderTrackItem.deleteMany({ where: { productId: id } });
    await tx.orderTrackItem.createMany({
      data: trackItemCreateData(id, trackItems),
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
