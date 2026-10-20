"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ParcelStatus, Prisma, ServiceTariff } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { nextParcelTaskNumber } from "@/lib/parcel-number";
import { nextDocumentNumber } from "@/lib/document-numbers";
import { notifyParcelStatusChange, notifyParcelPaid } from "@/lib/notify";
import { computeEuCustomsDuty, type DutyOrderLine, type DutyResult } from "@/lib/eu-customs";
import { parcelStatusLabel, PARCEL_STATUS_LABELS } from "@/lib/statuses";
import { ensureBaseline, ensureBaselines, recordVersion, recordVersions } from "@/lib/versions";
import { trackAfterResponse } from "@/lib/tracking";
import { activeServices, findShippingTariff } from "@/lib/tariffs";

const round2 = (n: number) => Math.round(n * 100) / 100;

type DutySettings = { euDutyEnabled: boolean; euDutyPassToClient: boolean; exchangeRateCnyPerEur: number; exchangeRateCnyPerUsd: number };

type OrderServiceFlags = {
  keepOriginalPackaging: boolean;
  detailedCheckRequested: boolean;
  consolidationRequested: boolean;
  compactPackRequested: boolean;
  standardCheckRequested: boolean;
  reinforcedPackRequested: boolean;
};

type ServiceLine = { code: string; name: string; priceUsd: number };

/**
 * Строки услуг по справочнику «Логистика → Тарифы»: название и цена — оттуда, не из кода.
 * Цена «за кг» — от расчётного веса, «за заказ» — по числу заказов, «%» и «по факту» — сумма от вызывающего.
 * Услуги, которой нет в справочнике или которая не действует, в посылке нет: её код попадает в missing.
 */
function serviceLines(services: Map<string, ServiceTariff>) {
  const lines: ServiceLine[] = [];
  const missing: string[] = [];
  const add = (code: string, base: { weightKg?: number; count?: number; amountUsd?: number }) => {
    const service = services.get(code);
    if (!service) {
      missing.push(code);
      return;
    }
    const value = Number(service.value ?? 0);
    const priceUsd =
      service.pricingType === "PER_KG" ? (base.weightKg ?? 0) * value
      : service.pricingType === "PER_ORDER" ? (base.count ?? 1) * value
      : (base.amountUsd ?? 0);
    lines.push({ code, name: service.name, priceUsd: round2(priceUsd) });
  };
  return { lines, missing, add };
}

/** Услуги посылки по флагам строк-заказов (OR по строкам). Вес — расчётный вес посылки. */
function servicesFromOrders(orders: OrderServiceFlags[], billableWeightKg: number, services: Map<string, ServiceTariff>): ServiceLine[] {
  const { lines, add } = serviceLines(services);
  if (orders.some((o) => o.consolidationRequested)) add("CONSOLIDATION", { weightKg: billableWeightKg });
  if (orders.some((o) => o.compactPackRequested)) add("COMPACT_PACK", { weightKg: billableWeightKg });
  if (orders.some((o) => o.standardCheckRequested)) add("STANDARD_CHECK", { weightKg: billableWeightKg });
  const detailedCount = orders.filter((o) => o.detailedCheckRequested).length;
  if (detailedCount > 0) add("DETAILED_CHECK", { count: detailedCount });
  // сумму усиленной упаковки задаёт админ на посылке — при оформлении фиксируем пожелание строкой 0 $
  if (orders.some((o) => o.reinforcedPackRequested)) add("REINFORCED_PACK", { amountUsd: 0 });
  const keepCount = orders.filter((o) => o.keepOriginalPackaging).length;
  if (keepCount > 0) add("KEEP_ORIGINAL_PACK", { count: keepCount });
  return lines;
}

/** Перезаписать строки услуг посылки и вернуть их сумму. */
async function saveParcelServices(
  parcelId: string,
  lines: ServiceLine[],
  rate: number,
  db: Prisma.TransactionClient = prisma,
): Promise<number> {
  await db.parcelService.deleteMany({ where: { parcelId } });
  for (const s of lines) {
    await db.parcelService.create({
      data: { parcelId, serviceCode: s.code, name: s.name, priceUsd: s.priceUsd, priceCny: round2(s.priceUsd * rate) },
    });
  }
  return round2(lines.reduce((s, l) => s + l.priceUsd, 0));
}

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

/**
 * Оформление: собрать принятые заказы одного клиента в задачу на формирование посылки
 * (номер SM3956US) и посылку (номер PS-000001). Пока АРМы этапов не готовы,
 * задача и посылка создаются вместе.
 */
export async function createParcelFromOrders(orderIds: string[]): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, status: "RECEIVED", deletedAt: null },
  });
  if (orders.length === 0) return { error: "Нет принятых заказов для оформления" };

  const first = orders[0];

  // Номер задачи: код клиента + сквозной номер + код страны доставки (напр. SM3956US)
  const customer = await prisma.customer.findUnique({
    where: { id: first.customerId },
    select: { code: true },
  });
  if (!customer?.code) {
    return { error: "У клиента не заполнен код — номер задачи собрать нельзя" };
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

  const taskNumber = await nextParcelTaskNumber(customer.code, recipient.countryCode);
  const billable = round2(orders.reduce((s, o) => s + Number(o.actualWeightKg ?? 0), 0));
  const settings = await prisma.financeSettings.findFirst();
  const rate = Number(settings?.exchangeRateCnyPerUsd ?? 7.1);
  // Тариф — по стране получателя и виду доставки («Логистика → Тарифы»)
  const tariff = await findShippingTariff(recipient.countryCode, first.deliveryType);
  const shippingCostUsd = tariff ? round2(billable * Number(tariff.pricePerKgUsd) + Number(tariff.handlingFeeUsd)) : 0;

  const { duty, passToClient } = await calcDutyFor(first.recipientId, orders);
  const dutyInTotal = passToClient && duty.applies ? duty.dutyUsd : 0;
  // услуги, выбранные клиентом на строках заказов, переходят в посылку (OR по строкам)
  const orderServices = servicesFromOrders(orders, billable, await activeServices());
  const servicesTotal = round2(orderServices.reduce((s, l) => s + l.priceUsd, 0));
  const totalUsd = round2(shippingCostUsd + servicesTotal + dutyInTotal);

  const parcel = await prisma.$transaction(async (tx) => {
    const task = await tx.parcelTask.create({
      data: {
        number: taskNumber,
        customerId: first.customerId,
        destinationCountry: recipient.countryCode!.toUpperCase(),
        createdById: session.user.id,
      },
    });
    const created = await tx.parcel.create({
      data: {
        number: await nextDocumentNumber(tx, "parcel"),
        parcelTaskId: task.id,
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
    const formedIds = orders.map((o) => o.id);
    await ensureBaselines("order", formedIds, tx);
    await tx.order.updateMany({
      where: { id: { in: formedIds } },
      data: { parcelId: created.id, parcelTaskId: task.id, status: "FORMED" },
    });
    await tx.parcelStatusHistory.create({
      data: { parcelId: created.id, status: "FORMED", changedBy: session.user.id },
    });
    await saveParcelServices(created.id, orderServices, rate, tx);
    // История изменений: посылка создана, заказы оформлены в неё
    await recordVersion("parcel", created.id, { authorId: session.user.id, comment: "Создана" }, tx);
    await recordVersions("order", formedIds, { authorId: session.user.id, comment: `Оформлен в посылку ${created.number}` }, tx);
    return created;
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
    include: { orders: true, recipient: { select: { countryCode: true } }, parcelTask: { select: { destinationCountry: true } } },
  });
  if (!parcel) return { ok: false };

  const { duty, passToClient } = await calcDutyFor(parcel.recipientId, parcel.orders, {
    manualLineCount: opts.customsDutyManualLines ?? null,
    passToClientOverride: opts.customsDutyPassToClient ?? null,
  });
  const dutyInTotal = passToClient && duty.applies ? duty.dutyUsd : 0;

  const rate = Number(parcel.exchangeRateCnyPerUsd);

  // Тариф — по стране получателя и виду доставки; нужен для ставки и делителя объёмного веса
  const country = parcel.recipient?.countryCode ?? parcel.parcelTask?.destinationCountry ?? null;
  const tariff = await findShippingTariff(country, parcel.deliveryType);

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
  const warnings: string[] = [];
  let shipping: number;
  if (tariff) {
    shipping = round2(billable * Number(tariff.pricePerKgUsd) + Number(tariff.handlingFeeUsd));
  } else {
    shipping = Number(parcel.shippingCostUsd ?? 0);
    warnings.push("Нет действующего тарифа для страны получателя и вида доставки — «Отправка» не пересчитана (тарифы — «Логистика → Тарифы»).");
  }

  const declaredTotal = parcel.orders.reduce((s, o) => s + Number(o.declaredValueUsd ?? 0), 0);
  const detailedCount = parcel.orders.filter((o) => o.detailedCheckRequested).length;

  const { lines: services, missing, add } = serviceLines(await activeServices());
  if (opts.consolidation) add("CONSOLIDATION", { weightKg: billable });
  if (opts.compactPack) add("COMPACT_PACK", { weightKg: billable });
  if (opts.standardCheck) add("STANDARD_CHECK", { weightKg: billable });
  if (detailedCount > 0) add("DETAILED_CHECK", { count: detailedCount });
  if (opts.reinforcedPackUsd && opts.reinforcedPackUsd > 0) {
    add("REINFORCED_PACK", { amountUsd: opts.reinforcedPackUsd });
  } else if (parcel.orders.some((o) => o.reinforcedPackRequested)) {
    // клиент просил усиленную упаковку, сумма ещё не задана — не теряем строку при пересчёте
    add("REINFORCED_PACK", { amountUsd: 0 });
  }
  if (opts.localDeliveryUsd && opts.localDeliveryUsd > 0) add("LOCAL_DELIVERY", { amountUsd: opts.localDeliveryUsd });
  if (opts.insurancePercent && opts.insurancePercent > 0) add("INSURANCE", { amountUsd: declaredTotal * (opts.insurancePercent / 100) });
  const keepCount = parcel.orders.filter((o) => o.keepOriginalPackaging).length;
  if (keepCount > 0) add("KEEP_ORIGINAL_PACK", { count: keepCount });
  if (missing.length) warnings.push(`Не начислены услуги, которых нет в «Логистика → Тарифы» или они не действуют: ${missing.join(", ")}.`);

  await ensureBaseline("parcel", parcelId);
  const servicesTotal = await saveParcelServices(parcelId, services, rate);
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
  await recordVersion("parcel", parcelId, { authorId: session.user.id, comment: "Пересчитана квитанция" });
  revalidatePath(`/parcels/${parcelId}`);
  return { ok: true, warning: warnings.join(" ") || undefined };
}

/** Сохранить трек-номер отслеживания посылки (исходящий трек до получателя). */
export async function setParcelTracking(parcelId: string, trackingNumber: string): Promise<void> {
  const session = await auth();
  if (!session) redirect("/login");
  const trimmed = trackingNumber.trim();
  await ensureBaseline("parcel", parcelId);
  const parcel = await prisma.parcel.update({
    where: { id: parcelId },
    data: { trackingNumber: trimmed || null },
  });
  await recordVersion("parcel", parcelId, { authorId: session.user.id, comment: "Изменён трек-номер посылки" });
  if (trimmed && parcel.status === "SHIPPED") trackAfterResponse([parcelId]);
  revalidatePath(`/parcels/${parcelId}`);
}

const PARCEL_STATUSES = Object.keys(PARCEL_STATUS_LABELS) as ParcelStatus[];

/**
 * Сменить статус одной посылки от имени сотрудника. Для оплаты «до отправки» не даёт SHIPPED без оплаты.
 * notify = false — без сообщения клиенту (например, когда закрывают давно дошедшие посылки).
 */
async function changeParcelStatus(parcelId: string, status: ParcelStatus, userId: string, notify = true): Promise<string | null> {
  const parcel = await prisma.parcel.findFirst({ where: { id: parcelId, deletedAt: null } });
  if (!parcel) return "Посылка не найдена";
  if (parcel.status === status) return null;
  if (status === "SHIPPED" && parcel.paymentTiming === "BEFORE" && !parcel.isPaid) {
    return "Нельзя отправить: посылка не оплачена (оплата до отправки)";
  }

  await ensureBaseline("parcel", parcelId);
  await prisma.parcel.update({ where: { id: parcelId }, data: { status } });
  await prisma.parcelStatusHistory.create({ data: { parcelId, status, changedBy: userId } });
  await recordVersion("parcel", parcelId, { authorId: userId, comment: `Статус «${parcelStatusLabel(status)}»` });
  if (notify) await notifyParcelStatusChange(parcelId, status);
  return null;
}

/** Смена статуса посылки. */
export async function setParcelStatus(parcelId: string, status: ParcelStatus): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Не авторизован" };
  if (!PARCEL_STATUSES.includes(status)) return { ok: false, error: "Неизвестный статус" };
  const error = await changeParcelStatus(parcelId, status, session.user.id);
  if (error) return { ok: false, error };
  if (status === "SHIPPED") trackAfterResponse([parcelId]);
  revalidatePath(`/parcels/${parcelId}`);
  return { ok: true };
}

/**
 * Статус сразу нескольким посылкам — ручной инструмент на крайний случай, когда отслеживание не помогло
 * (номер не отслеживается, перевозчик молчит). Каждая посылка — как при смене статуса в карточке.
 * notify = false — клиентам не писать: закрывают давно дошедшие посылки.
 */
export async function setParcelsStatus(
  parcelIds: string[],
  status: ParcelStatus,
  notify = true,
): Promise<{ ok: boolean; changed: number; errors: string[] }> {
  const session = await auth();
  if (!session) return { ok: false, changed: 0, errors: ["Не авторизован"] };
  if (!PARCEL_STATUSES.includes(status)) return { ok: false, changed: 0, errors: ["Неизвестный статус"] };
  const ids = [...new Set(parcelIds)].slice(0, 500);
  const parcels = await prisma.parcel.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, number: true, status: true } });

  const changedIds: string[] = [];
  const errors: string[] = [];
  for (const parcel of parcels) {
    if (parcel.status === status) continue;
    const error = await changeParcelStatus(parcel.id, status, session.user.id, notify !== false);
    if (error) errors.push(`${parcel.number}: ${error}`);
    else changedIds.push(parcel.id);
  }
  if (status === "SHIPPED") trackAfterResponse(changedIds);
  revalidatePath("/parcels");
  return { ok: errors.length === 0, changed: changedIds.length, errors };
}

export type TrackMatch = { id: string; number: string; trackingNumber: string; customerCode: string | null; status: ParcelStatus };

/** Найти посылки по списку трек-номеров (через пробел, запятую или с новой строки) — для смены статуса списком. */
export async function findParcelsByTracks(text: string): Promise<{ found: TrackMatch[]; missing: string[] }> {
  const session = await auth();
  if (!session) return { found: [], missing: [] };
  const numbers = [...new Set(text.split(/[\s,;]+/).map((n) => n.trim().toUpperCase()).filter(Boolean))].slice(0, 500);
  if (!numbers.length) return { found: [], missing: [] };

  const parcels = await prisma.parcel.findMany({
    where: {
      deletedAt: null,
      OR: [{ trackingNumber: { in: numbers, mode: "insensitive" } }, { tracking: { number: { in: numbers } } }],
    },
    select: { id: true, number: true, trackingNumber: true, status: true, customer: { select: { code: true } } },
    orderBy: { createdAt: "asc" },
  });
  const found = parcels.map((p) => ({
    id: p.id,
    number: p.number,
    trackingNumber: p.trackingNumber ?? "",
    customerCode: p.customer.code,
    status: p.status,
  }));
  const seen = new Set(found.map((p) => p.trackingNumber.replace(/\s+/g, "").toUpperCase()));
  return { found, missing: numbers.filter((n) => !seen.has(n)) };
}

/** Отметить оплату посылки. */
export async function setParcelPaid(parcelId: string, paid: boolean): Promise<void> {
  const session = await auth();
  if (!session) redirect("/login");
  await ensureBaseline("parcel", parcelId);
  await prisma.parcel.update({
    where: { id: parcelId },
    data: { isPaid: paid, paidAt: paid ? new Date() : null },
  });
  await recordVersion("parcel", parcelId, {
    authorId: session.user.id,
    comment: paid ? "Отмечена оплата" : "Снята отметка об оплате",
  });
  if (paid) await notifyParcelPaid(parcelId);
  revalidatePath(`/parcels/${parcelId}`);
}

/** Внутренние комментарии посылки и её задачи — видят только сотрудники. */
export async function setParcelInternalComments(
  parcelId: string,
  comments: { parcel: string; task: string },
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Не авторизован" };
  const parcel = await prisma.parcel.findFirst({ where: { id: parcelId, deletedAt: null }, select: { internalComment: true, parcelTaskId: true } });
  if (!parcel) return { ok: false, error: "Посылка не найдена" };
  const parcelComment = String(comments.parcel ?? "").trim().slice(0, 4000) || null;
  const taskComment = String(comments.task ?? "").trim().slice(0, 4000) || null;

  if (parcelComment !== parcel.internalComment) {
    await ensureBaseline("parcel", parcelId);
    await prisma.parcel.update({ where: { id: parcelId }, data: { internalComment: parcelComment } });
    await recordVersion("parcel", parcelId, { authorId: session.user.id, comment: "Изменён внутренний комментарий" });
  }
  if (parcel.parcelTaskId) {
    await prisma.parcelTask.update({ where: { id: parcel.parcelTaskId }, data: { internalComment: taskComment } });
  }
  revalidatePath(`/parcels/${parcelId}`);
  return { ok: true };
}
