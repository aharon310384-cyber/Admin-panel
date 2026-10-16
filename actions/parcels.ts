"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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

export async function createParcel(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

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

  const count = await prisma.parcel.count();
  const number = `ORD-${String(2024000 + count + 1).padStart(7, "0")}`;
  const total = parsed.data.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalCny = calculateTotalCny(total, parsed.data.exchangeRateCnyPerUsd);

  const parcel = await prisma.parcel.create({
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

  revalidatePath("/parcels");
  redirect(`/parcels/${parcel.id}`);
}

export async function updateParcelExchangeRate(
  parcelId: string,
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

  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: {
      total: true,
      totalUsd: true,
      localDeliveryCny: true,
      discountCny: true,
    },
  });

  if (!parcel) {
    throw new Error("Посылка не найдена");
  }

  const totalUsd = Number(parcel.totalUsd || parcel.total || 0);
  const totalCny = calculateTotalCny(
    totalUsd,
    parsed.data.exchangeRateCnyPerUsd,
    Number(parcel.localDeliveryCny ?? 0),
    Number(parcel.discountCny ?? 0)
  );

  await prisma.parcel.update({
    where: { id: parcelId },
    data: {
      exchangeRateCnyPerUsd: parsed.data.exchangeRateCnyPerUsd,
      totalCny,
    },
  });

  revalidatePath(`/parcels/${parcelId}`);
  revalidatePath("/parcels");
}

export async function updateParcelStatus(
  parcelId: string,
  status: ParcelStatus,
  note?: string
) {
  const session = await auth();
  if (!session) redirect("/login");

  await prisma.parcel.update({
    where: { id: parcelId },
    data: { status },
  });

  await prisma.parcelStatusHistory.create({
    data: {
      parcelId,
      status,
      changedBy: session.user.id,
      note: note ?? null,
    },
  });

  revalidatePath(`/parcels/${parcelId}`);
  revalidatePath("/parcels");
}

export async function deleteParcel(parcelId: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Нет доступа");
  }

  await prisma.parcel.update({
    where: { id: parcelId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/parcels");
}
