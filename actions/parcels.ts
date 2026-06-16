"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveOrderNumber } from "@/lib/order-number";
import { ORDER_NOT_IN_ACTIVE_PARCEL } from "@/lib/order-filters";
import { getFinanceSettings } from "@/lib/finance";
import { requireAuth, requireAdmin } from "@/lib/server-helpers";
import type { ParcelStatus } from "@prisma/client";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
});

const createParcelSchema = z.object({
  customerId: z.string().min(1, "Выберите получателя"),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Добавьте хотя бы один заказ"),
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

  const finance = await getFinanceSettings();
  const { clientCode, countryCode, routeNumber, number } = resolved.parts;
  const total = parsed.data.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalCny = calculateTotalCny(total, finance.exchangeRateCnyPerUsd);

  const order = await prisma.parcel.create({
    data: {
      number,
      customerId: parsed.data.customerId,
      notes: parsed.data.notes || null,
      total,
      totalUsd: total,
      exchangeRateCnyPerUsd: finance.exchangeRateCnyPerUsd,
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
  revalidatePath("/orders");
  redirect(`/parcels/${order.id}`);
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
  revalidatePath("/orders");
}

const createFromOrdersSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1, "Отметьте хотя бы один заказ"),
  notes: z.string().optional(),
});

export async function createParcelFromOrders(input: {
  orderIds: string[];
  notes?: string;
}) {
  const session = await requireAuth();

  const parsed = createFromOrdersSchema.safeParse({
    orderIds: input.orderIds,
    notes: input.notes,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const orders = await prisma.order.findMany({
    where: {
      id: { in: parsed.data.orderIds },
      deletedAt: null,
      ...ORDER_NOT_IN_ACTIVE_PARCEL,
    },
    select: {
      id: true,
      customerId: true,
      deliveryType: true,
      price: true,
      stock: true,
      trackItems: {
        select: { name: true, quantity: true, unitPrice: true, totalPrice: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (orders.length !== parsed.data.orderIds.length) {
    return {
      error: {
        orderIds: [
          "Часть заказов уже оформлена в другую посылку или удалена. Обновите страницу и попробуйте снова.",
        ],
      },
    };
  }

  const customerIds = new Set(orders.map((o) => o.customerId));
  if (customerIds.size > 1 || customerIds.has(null)) {
    return {
      error: {
        orderIds: ["В одной посылке могут быть только заказы одного получателя"],
      },
    };
  }
  const customerId = orders[0].customerId as string;

  const deliveryTypes = new Set(orders.map((o) => o.deliveryType ?? ""));
  if (deliveryTypes.size > 1) {
    return {
      error: {
        orderIds: ["Заказы должны иметь одинаковый тип доставки"],
      },
    };
  }

  const resolved = await resolveOrderNumber(customerId);
  if (!resolved.ok) {
    return {
      error: {
        orderIds: [
          resolved.recipient
            ? `У получателя не заполнены: ${resolved.missing.join(", ")}.`
            : "Получатель не найден",
        ],
      },
    };
  }

  const finance = await getFinanceSettings();
  const { clientCode, countryCode, routeNumber, number } = resolved.parts;
  const totalUsd = orders.reduce((sum, o) => sum + Number(o.price), 0);
  const totalCny = calculateTotalCny(totalUsd, finance.exchangeRateCnyPerUsd);

  const parcel = await prisma.parcel.create({
    data: {
      number,
      customerId,
      notes: parsed.data.notes || null,
      total: totalUsd,
      totalUsd,
      exchangeRateCnyPerUsd: finance.exchangeRateCnyPerUsd,
      totalCny,
      routePrefix: clientCode,
      routeNumber: String(routeNumber),
      routeCountry: countryCode,
      items: {
        create: orders.map((o) => {
          const track = o.trackItems[0];
          const quantity = track ? track.quantity : 1;
          const unitPrice = track ? Number(track.unitPrice) : Number(o.price);
          const lineTotalUsd = track
            ? Number(track.totalPrice ?? Number(track.unitPrice) * track.quantity)
            : Number(o.price);
          return {
            productId: o.id,
            quantity,
            price: unitPrice,
            name: track?.name ?? null,
            lineTotalUsd,
          };
        }),
      },
      statusHistory: {
        create: { status: "NEW", changedBy: session.user.id },
      },
    },
    select: { id: true, number: true },
  });

  revalidatePath("/parcels");
  revalidatePath("/orders");
  return { ok: true as const, parcelId: parcel.id, number: parcel.number };
}

export async function deleteParcel(orderId: string) {
  await requireAdmin();

  await prisma.parcel.update({
    where: { id: orderId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/parcels");
  revalidatePath("/orders");
}
