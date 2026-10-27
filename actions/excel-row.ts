"use server";

import { revalidatePath } from "next/cache";
import type { ParcelStatus, ParcelTaskStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { getFinanceSettings } from "@/lib/finance";
import { findExcelTracks } from "@/lib/ai-order-parser";
import { splitExcelRow } from "@/lib/excel-row";
import { alignRow, cellOf, cleanColumns, isPaidMark, numberOf, productItems, sentDateOf, type ExcelColumns } from "@/lib/excel-columns";
import { foundInText, latinCode, missedTracks, sameName } from "@/lib/excel-check";
import { splitLegacyTaskNumber } from "@/lib/parcel-number";
import { nextDocumentNumber } from "@/lib/document-numbers";
import { EU_DUTY_PER_ITEM_EUR } from "@/lib/eu-customs";
import { ensureBaselines, recordVersions } from "@/lib/versions";
import { getTrackingKey, shippedRecently, trackAfterResponse } from "@/lib/tracking";

// Загрузка из Excel, шаг 2 (docs/product/задание-excel.md): строка листа целиком → заказы → задача → посылка.
// ИИ находит в большой ячейке только входящие треки и какой товар к какому треку; всё остальное — из колонок строки.
// Ключ — номер задачи: повторная загрузка той же строки обновляет документы, а не создаёт новые.
// Клиентам ничего не отправляется, 17TRACK не дёргается (свежие отправленные посылки подхватит расписание).

export type ExcelRowItem = { name: string | null; comment: string | null; quantity: number };
export type ExcelRowTrack = { track: string | null; inText: boolean | null; items: ExcelRowItem[] };
export type ExcelRowService = { code: string; name: string; usd: number; cny: number };
/** Какой товар (по порядку в колонке наименований) к какому треку — ответ ИИ, его же передаём при сохранении. */
export type ExcelRowTracks = { tracks: string[]; itemTracks: (string | null)[] };

export type ExcelRowPreview = {
  taskNumber: string;
  internalComment: string | null;
  client: { id: string; code: string; name: string } | null;
  clientCode: string | null;
  countryCode: string | null;
  countryName: string | null;
  recipient: { name: string | null; address: string | null; phone: string | null };
  recipientMatch: { id: string; name: string } | null;
  /** получателя у клиента нет — при сохранении будет создан из строки */
  recipientNew: boolean;
  tracks: ExcelRowTrack[];
  found: ExcelRowTracks;
  weightKg: number | null;
  goodsValueUsd: number | null;
  services: ExcelRowService[];
  shippingUsd: number | null;
  /** к оплате: итого ¥ строки (или по формуле листа) и он же в долларах по курсу строки */
  totalUsd: number | null;
  rate: number;
  rateFromRow: boolean;
  euItemKinds: number | null;
  dutyEur: number | null;
  dutyCny: number | null;
  rateEur: number | null;
  localDeliveryCny: number | null;
  discountPercent: number | null;
  totalCny: number | null;
  paid: boolean;
  parcelTrack: string | null;
  sentDate: string | null;
  status: ParcelStatus;
  carrierCostCny: number | null;
  revenueCny: number | null;
  existing: { parcelId: string | null; parcelNumber: string | null; status: ParcelStatus | null } | null;
  /** что мешает сохранить */
  blockers: string[];
  warnings: string[];
};

export type ExcelRowPreviewResult = { ok: true; preview: ExcelRowPreview } | { ok: false; error: string; detail?: string };
export type ExcelRowSaveResult =
  | {
      ok: true;
      created: boolean;
      taskNumber: string;
      parcelId: string;
      parcelNumber: string;
      recipientCreated: string | null;
      tracking: boolean; // посылка ставится на слежение (17TRACK) сразу после сохранения
    }
  | { ok: false; error: string };
export type ExcelColumnsResult = { ok: boolean; message: string };

// Порядок статусов посылки: повторная загрузка не откатывает посылку назад (доставленная остаётся доставленной).
const STATUS_RANK: Record<ParcelStatus, number> = {
  FORMED: 0, ASSEMBLED: 1, PACKED: 2, READY_TO_SHIP: 3, SHIPPED: 4, DELIVERED: 5, RETURNED: 6, UTILIZED: 6,
};
const TASK_STATUS: Record<ParcelStatus, ParcelTaskStatus> = {
  FORMED: "NEW", ASSEMBLED: "ASSEMBLED", PACKED: "PACKED", READY_TO_SHIP: "COMPLETED",
  SHIPPED: "COMPLETED", DELIVERED: "COMPLETED", RETURNED: "CANCELED", UTILIZED: "CANCELED",
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");
const positive = (n: number | null) => (n != null && n > 0 ? n : null);

async function loadColumns(): Promise<ExcelColumns> {
  const settings = await prisma.excelImportSettings.findFirst({ select: { columns: true } });
  return cleanColumns(settings?.columns);
}

/** Колонки листа (буквы Excel). */
export async function getExcelColumns(): Promise<ExcelColumns> {
  await requireAdmin();
  return loadColumns();
}

/** Сохранить колонки листа: только известные поля и буквы; одна буква — одно поле. */
export async function saveExcelColumns(raw: Record<string, string>): Promise<ExcelColumnsResult> {
  const session = await requireAdmin();
  const columns = cleanColumns(raw);
  if (!columns.taskNumber || !columns.info) return { ok: false, message: "Укажите хотя бы номер строки и большую ячейку" };
  const used = new Map<string, string>();
  for (const [field, letter] of Object.entries(columns)) {
    if (used.has(letter)) return { ok: false, message: `Колонка ${letter} указана дважды` };
    used.set(letter, field);
  }
  const existing = await prisma.excelImportSettings.findFirst({ select: { id: true } });
  const data = { columns, updatedBy: session.user.id };
  if (existing) await prisma.excelImportSettings.update({ where: { id: existing.id }, data });
  else await prisma.excelImportSettings.create({ data });
  revalidatePath("/import/excel");
  return { ok: true, message: "Колонки сохранены" };
}

type RowBasics = {
  cells: string[];
  columns: ExcelColumns;
  taskNumber: string;
  tail: string | null;
  clientCode: string | null;
  client: { id: string; code: string; name: string } | null;
  country: { code: string; nameEn: string; phoneCode: string | null } | null;
  countryCode: string | null;
  recipient: { name: string | null; address: string | null; phone: string | null };
};

/** Номер строки, клиент, страна, получатель из колонок — без ИИ. */
async function readBasics(text: string): Promise<RowBasics | { error: string }> {
  const columns = await loadColumns();
  if (!columns.taskNumber || !columns.info) return { error: "Сначала укажите колонки листа (кнопка «Колонки листа»)" };
  const cells = alignRow(splitExcelRow(String(text ?? "")), columns);
  if (cells.length < 2) return { error: "Вставьте строку целиком: в Excel щёлкните по номеру строки слева и нажмите Ctrl+C" };

  const rawNumber = cellOf(cells, columns, "taskNumber") ?? "";
  const split = splitLegacyTaskNumber(rawNumber);
  if (!split.country) return { error: `«${rawNumber || "пусто"}» не похоже на номер строки (например OG4283AE). Скопируйте строку целиком: щёлкните по номеру строки слева и Ctrl+C.` };
  // Код клиента — буквы в начале номера: OG4283AE → OG, служебный ABC0001UA → ABC.
  const clientCode = split.number.match(/^[A-Z]{2,4}(?=\d)/)?.[0] ?? null;
  const [client, country] = await Promise.all([
    clientCode
      ? findClient(clientCode)
      : null,
    prisma.country.findUnique({ where: { code: split.country }, select: { code: true, nameEn: true, phoneCode: true } }),
  ]);
  return {
    cells,
    columns,
    taskNumber: split.number,
    tail: split.tail,
    clientCode,
    client: client ? { id: client.id, code: client.code ?? clientCode ?? "", name: client.name } : null,
    country,
    countryCode: split.country,
    recipient: {
      name: cellOf(cells, columns, "recipientName"),
      address: cellOf(cells, columns, "address"),
      phone: cellOf(cells, columns, "phone"),
    },
  };
}

/** Клиент по коду из номера строки: без учёта регистра и с кириллицей, похожей на латиницу («кс», «КС» = KC). */
async function findClient(code: string) {
  const clients = await prisma.customer.findMany({
    where: { deletedAt: null, code: { not: null } },
    select: { id: true, code: true, name: true },
  });
  return clients.find((c) => latinCode(c.code) === code) ?? null;
}

async function findRecipient(customerId: string, r: RowBasics["recipient"]) {
  const candidates = await prisma.recipient.findMany({
    where: { customerId, deletedAt: null },
    select: { id: true, name: true, phone: true, phoneDialCode: true },
  });
  const phone = digits(r.phone).slice(-9);
  return (
    candidates.find((c) => phone.length >= 7 && digits(`${c.phoneDialCode ?? ""}${c.phone ?? ""}`).endsWith(phone)) ??
    candidates.find((c) => r.name && sameName(c.name, r.name)) ??
    null
  );
}

/** Строка → то, что будет сохранено. found — ответ ИИ из предпросмотра (при сохранении ИИ не спрашиваем ещё раз). */
async function buildPreview(text: string, found?: ExcelRowTracks): Promise<ExcelRowPreviewResult> {
  const basics = await readBasics(text);
  if ("error" in basics) return { ok: false, error: basics.error };
  const { cells, columns } = basics;
  const num = (field: Parameters<typeof numberOf>[2]) => numberOf(cells, columns, field);

  const info = cellOf(cells, columns, "info") ?? "";
  const items = productItems(cellOf(cells, columns, "productNames"));
  let tracksFound: ExcelRowTracks;
  if (found) {
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const tracks = Array.isArray(found.tracks) ? found.tracks.map(text).filter((t): t is string => Boolean(t)) : [];
    const itemTracks = Array.isArray(found.itemTracks) ? found.itemTracks : [];
    tracksFound = { tracks, itemTracks: items.map((_, i) => text(itemTracks[i])) };
  } else if (info.trim()) {
    const ai = await findExcelTracks(info, items.map((i) => i.name));
    if (!ai.ok) return ai;
    tracksFound = { tracks: ai.tracks, itemTracks: ai.itemTracks };
  } else {
    tracksFound = { tracks: [], itemTracks: items.map(() => null) };
  }

  // Треки без повторов; товар — к своему треку, при одном треке — к нему.
  const key = (t: string) => t.replace(/\s+/g, "").toUpperCase();
  const trackList: string[] = [];
  for (const t of tracksFound.tracks) if (t.trim() && !trackList.some((x) => key(x) === key(t))) trackList.push(t.trim());
  const trackOfItem = items.map((_, i) => {
    const t = tracksFound.itemTracks[i];
    const known = t ? trackList.find((x) => key(x) === key(t)) : undefined;
    return known ?? (trackList.length === 1 ? trackList[0] : null);
  });

  const quantityCell = num("quantity");
  const quantities = items.map(() => 1);
  if (items.length === 1 && quantityCell && quantityCell >= 1) quantities[0] = Math.floor(quantityCell);
  const tracks: ExcelRowTrack[] = trackList.map((track) => {
    const own = items.map((item, i) => ({ item, i })).filter(({ i }) => trackOfItem[i] === track);
    return {
      track,
      inText: foundInText(track, info),
      items: own.length
        ? own.map(({ item, i }) => ({ name: item.name, comment: item.comment, quantity: quantities[i] }))
        : [{ name: null, comment: null, quantity: 1 }],
    };
  });
  items.forEach((item, i) => {
    if (!trackOfItem[i]) tracks.push({ track: null, inText: null, items: [{ name: item.name, comment: item.comment, quantity: quantities[i] }] });
  });

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!tracks.length) blockers.push("В строке нет ни входящих треков, ни наименований — заказы не из чего создать.");
  if (!basics.clientCode) blockers.push(`Номер ${basics.taskNumber} не начинается с букв клиента.`);
  else if (!basics.client) blockers.push(`Клиента ${basics.clientCode} нет в базе — создайте его в «Клиенты», потом загрузите строку снова.`);
  if (!basics.country) warnings.push(`Страны ${basics.countryCode} (конец номера) нет в справочнике стран.`);

  // Получателя нет у клиента — создаётся из строки при сохранении (владелец видит его в предпросмотре и подтверждает).
  const recipientMatch = basics.client ? await findRecipient(basics.client.id, basics.recipient) : null;
  const recipientNew = Boolean(basics.client && !recipientMatch && basics.recipient.name);
  if (basics.client && !recipientMatch && !basics.recipient.name) blockers.push("В строке нет получателя (колонка ФИО пустая).");

  const finance = await getFinanceSettings();
  const rowRate = num("rate");
  const rate = rowRate && rowRate > 0 ? rowRate : finance.exchangeRateCnyPerUsd;
  if (!rate) return { ok: false, error: "Курса ¥ за $ нет ни в строке, ни в «Финансы → Курс» — задайте курс." };
  if (!rowRate) warnings.push(`Курса в строке нет — взят курс из «Финансы → Курс»: ${rate}.`);

  const photo = cellOf(cells, columns, "photoReport");
  const photoUsd = num("photoReport");
  const serviceRows: { code: string; usd: number | null; cny: number | null }[] = [
    { code: "CONSOLIDATION", usd: positive(num("consolidationUsd")), cny: null },
    { code: "COMPACT_PACK", usd: positive(num("packagingUsd")), cny: null },
    { code: "DETAILED_CHECK", usd: photo && (photoUsd == null || photoUsd > 0) ? (photoUsd ?? 0) : null, cny: null },
    { code: "LOCAL_DELIVERY", usd: null, cny: positive(num("localDeliveryCny")) },
  ].filter((s) => s.usd != null || s.cny != null);
  const tariffs = await prisma.serviceTariff.findMany({ where: { code: { in: serviceRows.map((s) => s.code) } }, select: { code: true, name: true } });
  const services: ExcelRowService[] = [];
  for (const s of serviceRows) {
    const tariff = tariffs.find((t) => t.code === s.code);
    if (!tariff) {
      warnings.push(`Услуги ${s.code} нет в справочнике услуг — сумма не перенесена.`);
      continue;
    }
    const usd = s.usd ?? round2((s.cny ?? 0) / rate);
    services.push({ code: s.code, name: tariff.name, usd, cny: s.cny ?? round2(usd * rate) });
  }

  // Пошлина ЕС: €3 за вид товара × курс евро строки (нет — из «Финансы»). Решение владельца 2026-10-19.
  const rowRateEur = positive(num("rateEur"));
  const rateEur = rowRateEur ?? finance.exchangeRateCnyPerEur;
  const euItemKinds = positive(num("euItemKinds"));
  const dutyEur = euItemKinds ? euItemKinds * EU_DUTY_PER_ITEM_EUR : null;
  if (dutyEur != null && !rateEur) {
    return { ok: false, error: "Курса ¥ за € нет ни в строке, ни в «Финансы → Курс» — пошлину ЕС не посчитать, задайте курс." };
  }
  const dutyCny = dutyEur != null && rateEur ? round2(dutyEur * rateEur) : null;
  const shippingUsd = num("shippingUsd");
  const totalUsdCell = num("totalUsd");
  const localDeliveryCny = positive(num("localDeliveryCny"));
  const discountPercent = positive(num("discountPercent"));
  const totalCny = num("totalCny");
  const parcelTrack = cellOf(cells, columns, "parcelTrack");
  const sentDateCell = cellOf(cells, columns, "sentDate");
  const sentDate = sentDateOf(sentDateCell);
  const carrierCostCny = num("carrierCostCny");
  const revenueCny = num("revenueCny");

  // Сверка сумм строки: итого $ = отправка + услуги; итого ¥ = итого $ × курс + пошлина + локальная доставка − скидка.
  const servicesUsd = services.filter((s) => s.code !== "LOCAL_DELIVERY").reduce((sum, s) => sum + s.usd, 0);
  if (shippingUsd != null && totalUsdCell != null && Math.abs(shippingUsd + servicesUsd - totalUsdCell) > 0.01) {
    warnings.push(`Итого $ ${totalUsdCell} ≠ отправка ${shippingUsd} + услуги ${round2(servicesUsd)} — проверьте строку.`);
  }
  // Формула листа: итого ¥ = итого $ × курс + пошлина + локальная доставка − скидка % (скидка — не на пошлину).
  const base = totalUsdCell != null ? totalUsdCell * rate + (localDeliveryCny ?? 0) : null;
  const expectedCny = base != null ? round2(base + (dutyCny ?? 0) - (base * (discountPercent ?? 0)) / 100) : null;
  if (expectedCny != null && totalCny != null && Math.abs(expectedCny - totalCny) > 0.05) {
    warnings.push(`Итого ¥ ${totalCny} не сходится с расчётом по строке (${expectedCny}) — проверьте строку.`);
  }
  const finalCny = totalCny ?? expectedCny;
  if (carrierCostCny == null) warnings.push("Стоимость отправки для нас не заполнена.");
  if (sentDateCell && !sentDate) warnings.push(`Дата «${sentDateCell}» неполная — посылка не считается отправленной, время документов — момент сохранения.`);
  if (quantityCell && items.length > 1 && quantityCell !== items.length) {
    warnings.push(`Количество в строке — ${quantityCell}, наименований — ${items.length}: у каждого товара поставлено 1 шт, проверьте.`);
  }
  if (!items.length) warnings.push("Наименований нет — заказы будут без наименования.");
  const missed = missedTracks(info, trackList, [basics.recipient.phone, parcelTrack]);
  if (missed.length) warnings.push(`В большой ячейке есть похожие на трек номера, которых нет в разборе: ${missed.join(", ")}.`);
  if (tracks.some((t) => t.inText === false)) warnings.push("Трек, которого нет в тексте ячейки, — отмечен ⚠.");

  const existingTask = await prisma.parcelTask.findUnique({
    where: { number: basics.taskNumber },
    select: { parcel: { select: { id: true, number: true, status: true } } },
  });

  const status: ParcelStatus = sentDate || parcelTrack ? "SHIPPED" : "FORMED";
  return {
    ok: true,
    preview: {
      taskNumber: basics.taskNumber,
      internalComment: basics.tail,
      client: basics.client,
      clientCode: basics.clientCode,
      countryCode: basics.countryCode,
      countryName: basics.country?.nameEn ?? null,
      recipient: basics.recipient,
      recipientMatch: recipientMatch ? { id: recipientMatch.id, name: recipientMatch.name } : null,
      recipientNew,
      tracks,
      found: { tracks: trackList, itemTracks: trackOfItem },
      weightKg: positive(num("weightKg")),
      goodsValueUsd: positive(num("goodsValueUsd")),
      services,
      shippingUsd,
      totalUsd: finalCny != null ? round2(finalCny / rate) : null,
      rate,
      rateFromRow: Boolean(rowRate),
      euItemKinds,
      dutyEur,
      dutyCny,
      rateEur,
      localDeliveryCny,
      discountPercent,
      totalCny: finalCny,
      paid: isPaidMark(cellOf(cells, columns, "paid")),
      parcelTrack,
      sentDate: sentDate?.toISOString() ?? null,
      status,
      carrierCostCny,
      revenueCny,
      existing: existingTask
        ? { parcelId: existingTask.parcel?.id ?? null, parcelNumber: existingTask.parcel?.number ?? null, status: existingTask.parcel?.status ?? null }
        : null,
      blockers,
      warnings,
    },
  };
}

/** Разобрать строку и показать, что будет сохранено. В базу ничего не пишется. */
export async function previewExcelRow(text: string): Promise<ExcelRowPreviewResult> {
  await requireAdmin();
  return buildPreview(text);
}

/** Новый получатель клиента из строки: ФИО, адрес, телефон (код страны — отдельно), страна — из конца номера строки, по-английски из справочника. */
function newRecipientData(
  customerId: string,
  r: { name: string; address: string | null; phone: string | null },
  country: { code: string; nameEn: string; phoneCode: string | null } | null,
  authorId: string,
) {
  const phoneDigits = digits(r.phone);
  const dial = country?.phoneCode ?? null;
  const dialDigits = digits(dial);
  const withDial = Boolean(dialDigits && phoneDigits.startsWith(dialDigits) && phoneDigits.length > dialDigits.length + 5);
  return {
    customerId,
    name: r.name,
    address: r.address,
    phone: phoneDigits ? (withDial ? phoneDigits.slice(dialDigits.length) : phoneDigits) : null,
    phoneDialCode: withDial ? dial : null,
    countryCode: country?.code ?? null,
    country: country?.nameEn ?? null,
    authorId,
  };
}

/** Сохранить строку: заказы → задача → посылка. Время: заказы — T, задача — T + 10 с, посылка — T + 20 с (T — дата отправки или сейчас). */
export async function saveExcelRow(text: string, found: ExcelRowTracks): Promise<ExcelRowSaveResult> {
  const session = await requireAdmin();
  return saveRow(text, session.user.id, { found, createRecipient: true });
}

/**
 * Загрузка файлом: одна строка целиком — разбор (ИИ ищет треки) и сразу сохранение.
 * createRecipient — нет получателя у клиента → создать его из строки.
 */
export async function importExcelRow(text: string, opts: { createRecipient: boolean }): Promise<ExcelRowSaveResult> {
  const session = await requireAdmin();
  return saveRow(text, session.user.id, { createRecipient: opts.createRecipient });
}

async function saveRow(
  text: string,
  userId: string,
  opts: { found?: ExcelRowTracks; createRecipient: boolean },
): Promise<ExcelRowSaveResult> {
  const built = await buildPreview(text, opts.found);
  if (!built.ok) return built;
  const p = built.preview;
  if (p.blockers.length) return { ok: false, error: p.blockers.join(" ") };
  const client = p.client!;
  if (!p.recipientMatch && !(p.recipientNew && opts.createRecipient)) {
    return { ok: false, error: `Получателя ${p.recipient.name ?? ""} нет в списке получателей клиента ${client.code}.` };
  }
  const country =
    !p.recipientMatch && p.countryCode
      ? await prisma.country.findUnique({ where: { code: p.countryCode }, select: { code: true, nameEn: true, phoneCode: true } })
      : null;
  const author = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!author) return { ok: false, error: "Пользователь не найден — войдите заново" };

  const now = new Date();
  const T = p.sentDate ? new Date(p.sentDate) : now;
  const at = (seconds: number) => new Date(T.getTime() + seconds * 1000);
  const orders = p.tracks.flatMap((t) => t.items.map((item) => ({ ...item, track: t.track })));
  const has = (code: string) => p.services.some((s) => s.code === code);
  const comment = p.sentDate ? "Загружено из Excel" : "Загружено из Excel (не отправлена)";

  const result = await prisma.$transaction(async (tx) => {
    const recipientId =
      p.recipientMatch?.id ??
      (
        await tx.recipient.create({
          data: newRecipientData(client.id, { ...p.recipient, name: p.recipient.name! }, country, author.id),
          select: { id: true },
        })
      ).id;
    const existingTask = await tx.parcelTask.findUnique({
      where: { number: p.taskNumber },
      select: {
        id: true, status: true, internalComment: true,
        parcel: { select: { id: true, number: true, status: true, isPaid: true, paidAt: true } },
        orders: { where: { deletedAt: null }, select: { id: true }, orderBy: [{ createdAt: "asc" }, { number: "asc" }] },
      },
    });
    const created = !existingTask;
    const oldParcel = existingTask?.parcel ?? null;
    const status: ParcelStatus = oldParcel && STATUS_RANK[oldParcel.status] > STATUS_RANK[p.status] ? oldParcel.status : p.status;
    const paid = p.paid || Boolean(oldParcel?.isPaid);
    // Приписка к номеру строки — во внутренний комментарий задачи, не затирая то, что там уже написано.
    const oldComment = existingTask?.internalComment ?? null;
    const internalComment =
      !p.internalComment || oldComment?.includes(p.internalComment) ? oldComment ?? p.internalComment : [oldComment, p.internalComment].filter(Boolean).join("\n");

    // Задача
    const taskData = {
      customerId: client.id,
      destinationCountry: p.countryCode,
      status: TASK_STATUS[status],
      internalComment,
    };
    const task = existingTask
      ? await tx.parcelTask.update({ where: { id: existingTask.id }, data: taskData, select: { id: true } })
      : await tx.parcelTask.create({ data: { ...taskData, number: p.taskNumber, createdById: author.id, createdAt: at(10) }, select: { id: true } });

    // Посылка
    const parcelData = {
      customerId: client.id,
      recipientId,
      status,
      actualWeightKg: p.weightKg,
      billableWeightKg: p.weightKg,
      exchangeRateCnyPerUsd: p.rate,
      shippingCostUsd: p.shippingUsd,
      discountPercent: p.discountPercent,
      declaredValueUsd: p.goodsValueUsd,
      customsDutyLineCount: p.euItemKinds,
      customsDutyManualLines: p.euItemKinds,
      customsDutyUsd: p.dutyCny != null ? round2(p.dutyCny / p.rate) : null,
      customsDutyEur: p.dutyEur,
      totalUsd: p.totalUsd ?? 0,
      totalCny: p.totalCny ?? 0,
      isPaid: paid,
      paidAt: paid ? (oldParcel?.paidAt ?? T) : null,
      trackingNumber: p.parcelTrack,
    } satisfies Prisma.ParcelUncheckedUpdateInput;
    if (oldParcel) await ensureBaselines("parcel", [oldParcel.id], tx);
    const parcel = oldParcel
      ? await tx.parcel.update({ where: { id: oldParcel.id }, data: parcelData, select: { id: true, number: true } })
      : await tx.parcel.create({
          data: { ...parcelData, number: await nextDocumentNumber(tx, "parcel"), parcelTaskId: task.id, createdAt: at(20) },
          select: { id: true, number: true },
        });
    if (!oldParcel) {
      await tx.parcelStatusHistory.create({ data: { parcelId: parcel.id, status: "FORMED", changedBy: author.id, note: comment, createdAt: at(20) } });
    }
    if (status !== "FORMED" && status !== oldParcel?.status) {
      await tx.parcelStatusHistory.create({ data: { parcelId: parcel.id, status, changedBy: author.id, note: comment, createdAt: oldParcel ? now : at(30) } });
    }

    // Услуги и себестоимость (только сотрудники)
    await tx.parcelService.deleteMany({ where: { parcelId: parcel.id } });
    if (p.services.length) {
      await tx.parcelService.createMany({
        data: p.services.map((s) => ({ parcelId: parcel.id, serviceCode: s.code, name: s.name, priceUsd: s.usd, priceCny: s.cny })),
      });
    }
    const financeData = { carrierCostCny: p.carrierCostCny, revenueCny: p.revenueCny, updatedBy: author.id };
    await tx.parcelFinance.upsert({ where: { parcelId: parcel.id }, create: { parcelId: parcel.id, ...financeData }, update: financeData });

    // Заказы: существующие обновляются по порядку, недостающие создаются, лишние удаляются (помечаются).
    const oldOrders = existingTask?.orders ?? [];
    if (oldOrders.length) await ensureBaselines("order", oldOrders.map((o) => o.id), tx);
    const orderIds: string[] = [];
    for (const [index, o] of orders.entries()) {
      const data = {
        customerId: client.id,
        recipientId,
        productNameText: o.name,
        trackNumber: o.track,
        quantity: o.quantity,
        customerComment: o.comment,
        detailedCheckRequested: has("DETAILED_CHECK"),
        consolidationRequested: has("CONSOLIDATION"),
        compactPackRequested: has("COMPACT_PACK"),
        status: "FORMED" as const,
        parcelTaskId: task.id,
        parcelId: parcel.id,
      };
      const old = oldOrders[index];
      const saved = old
        ? await tx.order.update({ where: { id: old.id }, data, select: { id: true } })
        : await tx.order.create({ data: { ...data, number: await nextDocumentNumber(tx, "order"), authorId: author.id, createdAt: at(0) }, select: { id: true } });
      orderIds.push(saved.id);
    }
    const surplus = oldOrders.slice(orders.length).map((o) => o.id);
    if (surplus.length) {
      await tx.order.updateMany({ where: { id: { in: surplus } }, data: { deletedAt: now, parcelId: null, parcelTaskId: null } });
    }

    await recordVersions("order", orderIds, { authorId: author.id, comment: created ? comment : "Обновлено из Excel" }, tx);
    await recordVersions("parcel", [parcel.id], { authorId: author.id, comment: created ? comment : "Обновлено из Excel" }, tx);
    return { created, parcel, status };
  });

  // Отправленная посылка с трек-номером встаёт на слежение сразу, не дожидаясь проверки по расписанию (раз в 2 часа).
  // Отправленные больше 60 дней назад — как и по расписанию, только кнопкой в карточке: история не тратит квоту 17TRACK.
  const tracking = result.status === "SHIPPED" && Boolean(p.parcelTrack) && shippedRecently(T) && Boolean(await getTrackingKey());
  if (tracking) trackAfterResponse([result.parcel.id]);

  revalidatePath("/parcels");
  revalidatePath("/orders");
  return {
    ok: true,
    created: result.created,
    taskNumber: p.taskNumber,
    parcelId: result.parcel.id,
    parcelNumber: result.parcel.number,
    recipientCreated: p.recipientMatch ? null : p.recipient.name,
    tracking,
  };
}
