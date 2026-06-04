"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveOrderNumber } from "@/lib/order-number";
import { requireAuth, requireAdmin } from "@/lib/server-helpers";
import type { ParcelStatus } from "@prisma/client";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
});

const createParcelSchema = z.object({
  customerId: z.string().min(1, "Выберите получателя"),
  exchangeRateCnyPerUsd: z.coerce
    .number()
    .positive("Курс должен быть больше 0")
    .default(7.1),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Добавьте хотя бы один заказ"),
});

const exchangeRateSchema = z.object({
  exchangeRateCnyPerUsd: z.coerce
    .number()
    .positive("Курс должен быть больше 0"),
});

function calculateTotalCny(
  totalUsd: number,
  exchangeRateCnyPerUsd: number,
  localDeliveryCny = 0,
  discountPercent = 0
) {
  const subtotalCny = totalUsd * exchangeRateCnyPerUsd + localDeliveryCny;
  return subtotalCny - subtotalCny * (discountPercent / 100);
}

export async function createParcel(formData: FormData) {
  const session = await requireAuth();

  let items: unknown;
  try {
    items = JSON.parse(formData.get("items") as string);
  } catch {
    return { error: { items: ["Неверный формат позиций"] } };
  }

  const parsed = createParcelSchema.safeParse({
    customerId: formData.get("customerId"),
    exchangeRateCnyPerUsd: formData.get("exchangeRateCnyPerUsd") || 7.1,
    notes: formData.get("notes"),
    items,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const resolved = await resolveOrderNumber(parsed.data.customerId);

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

  const { clientCode, countryCode, routeNumber, number } = resolved.parts;
  const total = parsed.data.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalCny = calculateTotalCny(total, parsed.data.exchangeRateCnyPerUsd);

  const order = await prisma.parcel.create({
    data: {
      number,
      customerId: parsed.data.customerId,
      notes: parsed.data.notes || null,
      total,
      totalUsd: total,
      exchangeRateCnyPerUsd: parsed.data.exchangeRateCnyPerUsd,
      totalCny,
      routePrefix: clientCode,
      routeNumber: String(routeNumber),
      routeCountry: countryCode,
      items: {
        create: parsed.data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      },
      statusHistory: {
        create: { status: "NEW", changedBy: session.user.id },
      },
    },
  });

  revalidatePath("/parcels");
  redirect(`/parcels/${order.id}`);
}

export async function updateParcelExchangeRate(
  orderId: string,
  formData: FormData
) {
  await requireAdmin();

  const parsed = exchangeRateSchema.safeParse({
    exchangeRateCnyPerUsd: formData.get("exchangeRateCnyPerUsd"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const order = await prisma.parcel.findUnique({
    where: { id: orderId },
    select: {
      total: true,
      totalUsd: true,
      localDeliveryCny: true,
      discountCny: true,
    },
  });

  if (!order) {
    throw new Error("Посылка не найдена");
  }

  const totalUsd = Number(order.totalUsd || order.total || 0);
  const totalCny = calculateTotalCny(
    totalUsd,
    parsed.data.exchangeRateCnyPerUsd,
    Number(order.localDeliveryCny ?? 0),
    Number(order.discountCny ?? 0)
  );

  await prisma.parcel.update({
    where: { id: orderId },
    data: {
      exchangeRateCnyPerUsd: parsed.data.exchangeRateCnyPerUsd,
      totalCny,
    },
  });

  revalidatePath(`/parcels/${orderId}`);
  revalidatePath("/parcels");
}

export async function updateParcelStatus(
  orderId: string,
  status: ParcelStatus,
  note?: string
) {
  const session = await requireAuth();

  await prisma.parcel.update({
    where: { id: orderId },
    data: { status },
  });

  await prisma.parcelStatusHistory.create({
    data: {
      orderId,
      status,
      changedBy: session.user.id,
      note: note ?? null,
    },
  });

  revalidatePath(`/parcels/${orderId}`);
  revalidatePath("/parcels");
}

export async function deleteParcel(orderId: string) {
  await requireAdmin();

  await prisma.parcel.update({
    where: { id: orderId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/parcels");
}
