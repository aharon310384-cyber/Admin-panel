"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ParcelStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { nextParcelNumber } from "@/lib/parcel-number";
import { notifyParcelStatusChange, notifyParcelPaid } from "@/lib/notify";
import { computeEuCustomsDuty, type DutyOrderLine, type DutyResult } from "@/lib/eu-customs";

const round2 = (n: number) => Math.round(n * 100) / 100;

type DutySettings = { euDutyEnabled: boolean; euDutyPassToClient: boolean; exchangeRateCnyPerEur: number; exchangeRateCnyPerUsd: number };

/** Рассчитать пошлину ЕС для набора строк и страны получателя. */
async function calcDutyFor(
  recipientId: string | null | undefined,
  orders: (DutyOrderLine & { declaredValueUsd?: unknown })[],
  opts?: { manualLineCount?: number | null; passToClientOverride?: boolean | null },
): Promise<{ duty: DutyResult; passToClient: boolean }> {
  const settings = (await prisma.financeSettings.findFirst()) as DutySettings | null;
  let destinationIsEu = false;
  if (recipientId) {
    const recipient = await prisma.recipient.findUnique({
      where: { id: recipientId },
      select: { countryCode: true },
    });
    if (recipient?.countryCode) {
      const country = await prisma.country.findUnique({
        where: { code: recipient.countryCode },
        select: { isEu: true },
      });
      destinationIsEu = country?.isEu ?? false;
    }
  }
  const declaredValueUsd = orders.reduce((s, o) => s + Number(o.declaredValueUsd ?? 0), 0);
  const duty = computeEuCustomsDuty({
    enabled: settings?.euDutyEnabled ?? true,
    destinationIsEu,
    declaredValueUsd,
    exchangeRateCnyPerEur: Number(settings?.exchangeRateCnyPerEur ?? 7.8),
    exchangeRateCnyPerUsd: Number(settings?.exchangeRateCnyPerUsd ?? 7.1),
    orders,
    manualLineCount: opts?.manualLineCount ?? null,
  });
  // Переопределение на уровне посылки приоритетнее глобальной настройки
  const passToClient =
    opts?.passToClientOverride != null ? opts.passToClientOverride : settings?.euDutyPassToClient ?? true;
  return { duty, passToClient };
}

/** Оформление: собрать принятые заказы одного клиента в новую посылку. */
export async function createParcelFromOrders(orderIds: string[]): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, status: "RECEIVED", deletedAt: null },
  });
  if (orders.length === 0) return { error: "Нет принятых заказов для оформления" };

  const first = orders[0];

  // Номер посылки: код клиента + сквозной номер + код страны доставки (напр. SM3956US)
  const customer = await prisma.customer.findUnique({
    where: { id: first.customerId },
    select: { code: true },
  });
  if (!customer?.code) {
    return { error: "У клиента не заполнен код — номер посылки собрать нельзя" };
  }
  const recipient = first.recipientId
    ? await prisma.recipient.findUnique({
        where: { id: first.recipientId },
        select: { countryCode: true },
      })
    : null;
  if (!recipient?.countryCode) {
    return { error: "У получателя не указана страна доставки — заполните её перед оформлением" };
  }

  const number = await nextParcelNumber(customer.code, recipient.countryCode);
  const billable = round2(orders.reduce((s, o) => s + Number(o.actualWeightKg ?? 0), 0));
  const settings = await prisma.financeSettings.findFirst();
  const rate = Number(settings?.exchangeRateCnyPerUsd ?? 7.1);
  const tariff = first.deliveryType
    ? await prisma.shippingTariff.findFirst({ where: { deliveryType: first.deliveryType, active: true } })
    : null;
  const shippingCostUsd = tariff ? round2(billable * Number(tariff.pricePerKgUsd) + Number(tariff.handlingFeeUsd)) : 0;

  const { duty, passToClient } = await calcDutyFor(first.recipientId, orders);
  const dutyInTotal = passToClient && duty.applies ? duty.dutyUsd : 0;
  const totalUsd = round2(shippingCostUsd + dutyInTotal);

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
      customsDutyEur: duty.applies ? duty.dutyEur : null,
      customsDutyUsd: duty.applies ? duty.dutyUsd : null,
      customsDutyLineCount: duty.applies ? duty.lineCount : null,
      totalUsd,
      totalCny: round2(totalUsd * rate),
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
  actualWeightKg?: number;
  billableWeightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  consolidation?: boolean;
  compactPack?: boolean;
  standardCheck?: boolean;
  reinforcedPackUsd?: number;
  localDeliveryUsd?: number;
  insurancePercent?: number;
  discountPercent?: number;
  customsDutyManualLines?: number | null; // ручной перебор числа позиций (типов товара); null = авто
  customsDutyPassToClient?: boolean | null; // переопределение «в счёт клиента»; null = как в настройках
};

/** Применить услуги, обновить вес и пересчитать квитанцию посылки. */
export async function applyParcelServices(
  parcelId: string,
  opts: ServiceOpts,
): Promise<{ ok: boolean; warning?: string }> {
  const session = await auth();
  if (!session) redirect("/login");

  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    include: { orders: true },
  });
  if (!parcel) return { ok: false };

  const { duty, passToClient } = await calcDutyFor(parcel.recipientId, parcel.orders, {
    manualLineCount: opts.customsDutyManualLines ?? null,
    passToClientOverride: opts.customsDutyPassToClient ?? null,
  });
  const dutyInTotal = passToClient && duty.applies ? duty.dutyUsd : 0;

  const rate = Number(parcel.exchangeRateCnyPerUsd);

  // Тариф (пока по типу доставки — направление отложено); нужен для ставки и делителя объёмного веса
  const tariff = parcel.deliveryType
    ? await prisma.shippingTariff.findFirst({ where: { deliveryType: parcel.deliveryType, active: true } })
    : null;

  // Вес фактический вводится вручную
  const actualWeightKg =
    opts.actualWeightKg != null ? round2(opts.actualWeightKg) : Number(parcel.actualWeightKg ?? 0);

  // Габариты и объёмный вес = Д × Ш × В (см) ÷ делитель (тариф или 6000)
  const lengthCm = opts.lengthCm != null ? round2(opts.lengthCm) : Number(parcel.lengthCm ?? 0);
  const widthCm = opts.widthCm != null ? round2(opts.widthCm) : Number(parcel.widthCm ?? 0);
  const heightCm = opts.heightCm != null ? round2(opts.heightCm) : Number(parcel.heightCm ?? 0);
  const divisor = tariff?.volumetricDivisor ?? 6000;
  const volumetricWeightKg =
    lengthCm > 0 && widthCm > 0 && heightCm > 0
      ? round2((lengthCm * widthCm * heightCm) / divisor)
      : 0;

  // Расчётный вес: если перебит вручную (> 0) — берём его, иначе max(факт, объёмный)
  const billable =
    opts.billableWeightKg && opts.billableWeightKg > 0
      ? round2(opts.billableWeightKg)
      : Math.max(actualWeightKg, volumetricWeightKg);
  let warning: string | undefined;
  let shipping: number;
  if (tariff) {
    shipping = round2(billable * Number(tariff.pricePerKgUsd) + Number(tariff.handlingFeeUsd));
  } else {
    shipping = Number(parcel.shippingCostUsd ?? 0);
    warning = "Тариф по типу доставки не найден — «Отправка» не пересчитана.";
  }

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
  // скидка — только на услуги Postmanfox; пошлина ЕС добавляется отдельно, после скидки
  const afterDiscount = round2(subtotal - subtotal * (discountPercent / 100));
  const totalUsd = round2(afterDiscount + dutyInTotal);

  await prisma.parcel.update({
    where: { id: parcelId },
    data: {
      actualWeightKg,
      volumetricWeightKg,
      billableWeightKg: billable,
      lengthCm,
      widthCm,
      heightCm,
      shippingCostUsd: shipping,
      discountPercent,
      customsDutyEur: duty.applies ? duty.dutyEur : null,
      customsDutyUsd: duty.applies ? duty.dutyUsd : null,
      customsDutyLineCount: duty.applies ? duty.lineCount : null,
      customsDutyManualLines: opts.customsDutyManualLines ?? null,
      customsDutyPassToClient: opts.customsDutyPassToClient ?? null,
      totalUsd,
      totalCny: round2(totalUsd * rate),
    },
  });
  revalidatePath(`/parcels/${parcelId}`);
  return { ok: true, warning };
}

/** Сохранить трек-номер отслеживания посылки (исходящий трек до получателя). */
export async function setParcelTracking(parcelId: string, trackingNumber: string): Promise<void> {
  const session = await auth();
  if (!session) redirect("/login");
  const trimmed = trackingNumber.trim();
  await prisma.parcel.update({
    where: { id: parcelId },
    data: { trackingNumber: trimmed || null },
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
  await notifyParcelStatusChange(parcelId, status);
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
  if (paid) await notifyParcelPaid(parcelId);
  revalidatePath(`/parcels/${parcelId}`);
}
