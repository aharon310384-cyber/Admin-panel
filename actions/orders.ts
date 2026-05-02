"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
});

const createOrderSchema = z.object({
  customerId: z.string().min(1, "Выберите получателя"),
  exchangeRateCnyPerUsd: z.coerce
    .number()
    .positive("Курс должен быть больше 0")
    .default(7.1),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Добавьте хотя бы одну услугу или позицию"),
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
  discountCny = 0
) {
  return totalUsd * exchangeRateCnyPerUsd + localDeliveryCny - discountCny;
}

export async function createOrder(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  let items: unknown;
  try {
    items = JSON.parse(formData.get("items") as string);
  } catch {
    return { error: { items: ["Неверный формат позиций"] } };
  }

  const parsed = createOrderSchema.safeParse({
    customerId: formData.get("customerId"),
    exchangeRateCnyPerUsd: formData.get("exchangeRateCnyPerUsd") || 7.1,
    notes: formData.get("notes"),
    items,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const count = await prisma.order.count();
  const number = `ORD-${String(2024000 + count + 1).padStart(7, "0")}`;
  const total = parsed.data.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalCny = calculateTotalCny(total, parsed.data.exchangeRateCnyPerUsd);

  const order = await prisma.order.create({
    data: {
      number,
      customerId: parsed.data.customerId,
      notes: parsed.data.notes || null,
      total,
      totalUsd: total,
      exchangeRateCnyPerUsd: parsed.data.exchangeRateCnyPerUsd,
      totalCny,
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

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function updateOrderExchangeRate(
  orderId: string,
  formData: FormData
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Нет доступа");
  }

  const parsed = exchangeRateSchema.safeParse({
    exchangeRateCnyPerUsd: formData.get("exchangeRateCnyPerUsd"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      total: true,
      totalUsd: true,
      localDeliveryCny: true,
      discountCny: true,
    },
  });

  if (!order) {
    throw new Error("Заказ не найден");
  }

  const totalUsd = Number(order.totalUsd || order.total || 0);
  const totalCny = calculateTotalCny(
    totalUsd,
    parsed.data.exchangeRateCnyPerUsd,
    Number(order.localDeliveryCny ?? 0),
    Number(order.discountCny ?? 0)
  );

  await prisma.order.update({
    where: { id: orderId },
    data: {
      exchangeRateCnyPerUsd: parsed.data.exchangeRateCnyPerUsd,
      totalCny,
    },
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string
) {
  const session = await auth();
  if (!session) redirect("/login");

  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status,
      changedBy: session.user.id,
      note: note ?? null,
    },
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function deleteOrder(orderId: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Нет доступа");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/orders");
}
