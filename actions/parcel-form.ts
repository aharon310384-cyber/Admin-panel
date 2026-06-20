"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ParcelStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { nextParcelNumber } from "@/lib/parcel-number";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Оформление: собрать принятые заказы одного клиента в новую посылку. */
export async function createParcelFromOrders(orderIds: string[]): Promise<void> {
  const session = await auth();
  if (!session) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, status: "RECEIVED", deletedAt: null },
  });
  if (orders.length === 0) return;

  const first = orders[0];
  const number = await nextParcelNumber();
  const billable = round2(orders.reduce((s, o) => s + Number(o.actualWeightKg ?? 0), 0));
  const settings = await prisma.financeSettings.findFirst();
  const rate = Number(settings?.exchangeRateCnyPerUsd ?? 7.1);
  const tariff = first.deliveryType
    ? await prisma.shippingTariff.findFirst({ where: { deliveryType: first.deliveryType, active: true } })
    : null;
  const shippingCostUsd = tariff ? round2(billable * Number(tariff.pricePerKgUsd) + Number(tariff.handlingFeeUsd)) : 0;

  const parcel = await prisma.parcel.create({
    data: {
      number,
      customerId: first.customerId,
      recipientId: first.recipientId,
      deliveryType: first.deliveryType,
      status: "FORMED",
      actualWeightKg: billable,
      billableWeightKg: billable,
      exchangeRateCnyPerUsd: rate,
      paymentTiming: tariff?.paymentTiming ?? "BEFORE",
      shippingCostUsd,
      totalUsd: shippingCostUsd,
      totalCny: round2(shippingCostUsd * rate),
    },
  });
  await prisma.order.updateMany({
    where: { id: { in: orders.map((o) => o.id) } },
    data: { parcelId: parcel.id, status: "FORMED" },
  });
  await prisma.parcelStatusHistory.create({
    data: { parcelId: parcel.id, status: "FORMED", changedBy: session.user.id },
  });

  redirect(`/parcels/${parcel.id}`);
}

export type ServiceOpts = {
  consolidation?: boolean;
  compactPack?: boolean;
  standardCheck?: boolean;
  reinforcedPackUsd?: number;
  localDeliveryUsd?: number;
  insurancePercent?: number;
  discountPercent?: number;
};

/** Применить услуги и пересчитать квитанцию посылки. */
export async function applyParcelServices(parcelId: string, opts: ServiceOpts): Promise<void> {
  const session = await auth();
  if (!session) redirect("/login");

  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    include: { orders: true },
  });
  if (!parcel) return;

  const billable = Number(parcel.billableWeightKg ?? parcel.actualWeightKg ?? 0);
  const rate = Number(parcel.exchangeRateCnyPerUsd);
  const shipping = Number(parcel.shippingCostUsd ?? 0);
  const declaredTotal = parcel.orders.reduce((s, o) => s + Number(o.declaredValueUsd ?? 0), 0);
  const detailedCount = parcel.orders.filter((o) => o.detailedCheckRequested).length;

  const services: { code: string; name: string; priceUsd: number }[] = [];
  if (opts.consolidation) services.push({ code: "CONSOLIDATION", name: "Консолидация", priceUsd: round2(billable * 0.3) });
  if (opts.compactPack) services.push({ code: "COMPACT_PACK", name: "Компактная упаковка", priceUsd: round2(billable * 0.5) });
  if (opts.standardCheck) services.push({ code: "STANDARD_CHECK", name: "Стандартная проверка на соответствие", priceUsd: round2(billable * 1.0) });
  if (detailedCount > 0) services.push({ code: "DETAILED_CHECK", name: "Детальная проверка и фотоотчёт", priceUsd: round2(detailedCount * 2.0) });
  if (opts.reinforcedPackUsd && opts.reinforcedPackUsd > 0) services.push({ code: "REINFORCED_PACK", name: "Усиленная упаковка", priceUsd: round2(opts.reinforcedPackUsd) });
  if (opts.localDeliveryUsd && opts.localDeliveryUsd > 0) services.push({ code: "LOCAL_DELIVERY", name: "Доставка до склада", priceUsd: round2(opts.localDeliveryUsd) });
  if (opts.insurancePercent && opts.insurancePercent > 0) services.push({ code: "INSURANCE", name: "Дополнительная страховка", priceUsd: round2(declaredTotal * (opts.insurancePercent / 100)) });

  // сохраняем строки услуг
  await prisma.parcelService.deleteMany({ where: { parcelId } });
  for (const s of services) {
    await prisma.parcelService.create({
      data: { parcelId, serviceCode: s.code, name: s.name, priceUsd: s.priceUsd, priceCny: round2(s.priceUsd * rate) },
    });
  }

  const servicesTotal = services.reduce((s, x) => s + x.priceUsd, 0);
  const subtotal = round2(shipping + servicesTotal);
  const discountPercent = opts.discountPercent ?? 0;
  const totalUsd = round2(subtotal - subtotal * (discountPercent / 100));

  await prisma.parcel.update({
    where: { id: parcelId },
    data: { discountPercent, totalUsd, totalCny: round2(totalUsd * rate) },
  });
  revalidatePath(`/parcels/${parcelId}`);
}

/** Смена статуса посылки. Для оплаты «до отправки» блокирует SHIPPED без оплаты. */
export async function setParcelStatus(parcelId: string, status: ParcelStatus): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Не авторизован" };

  const parcel = await prisma.parcel.findUnique({ where: { id: parcelId } });
  if (!parcel) return { ok: false, error: "Посылка не найдена" };

  if (status === "SHIPPED" && parcel.paymentTiming === "BEFORE" && !parcel.isPaid) {
    return { ok: false, error: "Нельзя отправить: посылка не оплачена (оплата до отправки)" };
  }

  await prisma.parcel.update({ where: { id: parcelId }, data: { status } });
  await prisma.parcelStatusHistory.create({ data: { parcelId, status, changedBy: session.user.id } });
  revalidatePath(`/parcels/${parcelId}`);
  return { ok: true };
}

/** Отметить оплату посылки. */
export async function setParcelPaid(parcelId: string, paid: boolean): Promise<void> {
  const session = await auth();
  if (!session) redirect("/login");
  await prisma.parcel.update({
    where: { id: parcelId },
    data: { isPaid: paid, paidAt: paid ? new Date() : null },
  });
  revalidatePath(`/parcels/${parcelId}`);
}
