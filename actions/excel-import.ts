"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { getFinanceSettings } from "@/lib/finance";
import { parseExcelInfo, type CatalogGroup } from "@/lib/ai-order-parser";
import { addressInText, foundInText, groupByTrack, missedTracks, normalizeText, parcelTracks, priceInText, sameName } from "@/lib/excel-check";

// Загрузка из Excel, шаг 1 — проверка ИИ-разборщика (docs/product/задание-excel.md).
// «Большая ячейка» строки → что нашёл ИИ, и есть ли это на самом деле в тексте ячейки. Ничего не сохраняется.

/** Значение и проверка по тексту ячейки: ok = null — проверять нечего (пусто). */
export type Checked = { value: string | null; ok: boolean | null; note?: string };

/** Товар = будущий заказ. group — группа справочника наименований («Сумки, обувь, аксессуары»). */
export type ExcelCheckOrder = {
  name: Checked;
  group: string | null;
  quantity: number;
  priceCny: number | null;
  priceUsd: number | null;
  priceOk: boolean | null;
  comment: string | null;
  deliveryType: string | null;
  detailedCheck: boolean;
  keepOriginalPackaging: boolean;
};

/** Входящий трек и его товары — одна строка проверки. */
export type ExcelCheckTrack = { track: Checked; items: ExcelCheckOrder[] };

export type ExcelCheckRecipient = {
  name: Checked;
  address: Checked;
  city: string | null;
  postalCode: string | null;
  phone: Checked;
  countryCode: string | null;
  countryName: string | null;
};

export type ExcelCheckResult =
  | {
      ok: true;
      rate: number;
      clientCode: string | null;
      client: { id: string; code: string | null; name: string } | null;
      tracks: ExcelCheckTrack[];
      recipient: ExcelCheckRecipient | null;
      recipientMatch: { id: string; name: string } | null;
      parcelTrack: Checked;
      warnings: string[];
      raw: string;
    }
  | { ok: false; error: string; detail?: string };

const NO_NAME = "не указано";

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** rate — курс строки Excel (¥ за $); не передан — курс из «Финансы → Курс». */
export async function checkExcelRow(input: { orderNumber?: string; rate?: string; info: string }): Promise<ExcelCheckResult> {
  await requireAdmin();
  const info = String(input.info ?? "");
  const rateText = String(input.rate ?? "").replace(",", ".").trim();
  const rate = rateText ? Number(rateText) : (await getFinanceSettings()).exchangeRateCnyPerUsd;
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return { ok: false, error: "Курс — число юаней за доллар, например 6,8" };

  const orderNumber = String(input.orderNumber ?? "").trim().toUpperCase();
  // Код клиента — буквы в начале номера: SM2992UA → SM, служебный ABC0001UA → ABC.
  const clientCode = orderNumber.match(/^[A-Z]{2,4}(?=\d)/)?.[0] ?? null;

  const groups = await catalogGroups();
  const parsed = await parseExcelInfo(info, groups, rate);
  if (!parsed.ok) return parsed;

  const groupByName = new Map(groups.map((g) => [normalizeText(g.group), g.group]));
  const itemNames = new Set(groups.flatMap((g) => g.items).map(normalizeText));
  const text = (value: string | null): Checked => ({ value, ok: value ? foundInText(value, info) : null });

  const items = parsed.orders.map((o) => {
    const unnamed = o.productNameText === NO_NAME;
    const key = normalizeText(o.productNameText);
    const name: Checked = unnamed
      ? { value: null, ok: false, note: "товар не назван" }
      : foundInText(o.productNameText, info)
        ? { value: o.productNameText, ok: true }
        : groupByName.has(key)
          ? { value: o.productNameText, ok: false, note: "это название группы, а не товара" }
          : itemNames.has(key)
            ? { value: o.productNameText, ok: true, note: "по справочнику наименований" }
            : { value: o.productNameText, ok: false };
    const price = o.unitPriceCny ?? o.unitPriceUsd;
    const order: ExcelCheckOrder = {
      name,
      group: o.group ? (groupByName.get(normalizeText(o.group)) ?? null) : null,
      quantity: o.quantity,
      priceCny: o.unitPriceCny,
      priceUsd: o.unitPriceUsd,
      priceOk: price != null ? priceInText(price, o.quantity, info) : null,
      comment: o.customerComment,
      deliveryType: o.deliveryType,
      detailedCheck: o.detailedCheckRequested,
      keepOriginalPackaging: o.keepOriginalPackaging,
    };
    return { trackNumber: o.trackNumber, order };
  });
  const tracks: ExcelCheckTrack[] = groupByTrack(items, (i) => i.trackNumber).map((g) => ({
    track: text(g.track),
    items: g.items.map((i) => i.order),
  }));
  const orders = tracks.flatMap((t) => t.items);

  const r = parsed.recipient;
  const country = r?.countryCode ? await prisma.country.findUnique({ where: { code: r.countryCode }, select: { nameRu: true } }) : null;
  const recipient: ExcelCheckRecipient | null = r
    ? {
        name: text(r.name),
        address: { value: r.address, ok: r.address ? addressInText(r.address, info) : null },
        city: r.city,
        postalCode: r.postalCode,
        phone: { value: r.phone, ok: r.phone ? foundInText(r.phone, info, "digits") : null },
        countryCode: r.countryCode,
        countryName: country?.nameRu ?? null,
      }
    : null;

  const warnings: string[] = [];
  const client = clientCode
    ? await prisma.customer.findFirst({ where: { code: clientCode, deletedAt: null }, select: { id: true, code: true, name: true } })
    : null;
  if (!orderNumber) warnings.push("Не указан номер строки (order_number) — клиент не определён.");
  else if (!clientCode) warnings.push(`Номер ${orderNumber} не начинается с букв клиента (SM2992UA, ABC0001UA).`);
  else if (!client) warnings.push(`Клиента ${clientCode} нет в справочнике — при загрузке его нужно будет создать.`);

  let recipientMatch: { id: string; name: string } | null = null;
  if (client && r) {
    const candidates = await prisma.recipient.findMany({
      where: { customerId: client.id, deletedAt: null },
      select: { id: true, name: true, phone: true, phoneDialCode: true },
    });
    const phone = digits(r.phone).slice(-9);
    recipientMatch =
      candidates.find((c) => phone.length >= 7 && digits(`${c.phoneDialCode ?? ""}${c.phone ?? ""}`).endsWith(phone)) ??
      candidates.find((c) => r.name && sameName(c.name, r.name)) ??
      null;
    if (!recipientMatch) warnings.push(`Получателя нет в списке получателей клиента ${client.code} — при загрузке его нужно будет создать.`);
  }
  if (!r) warnings.push("Получатель в ячейке не найден.");
  else if (!r.countryCode) warnings.push("Страна получателя не определена — тариф по стране не подобрать.");
  else if (!country) warnings.push(`Страны ${r.countryCode} нет в справочнике стран.`);

  // Трек посылки до получателя: от ИИ или найденный в тексте по виду номера
  const foundParcelTrack = parcelTracks(info)[0] ?? null;
  const parcelTrack: Checked = parsed.parcelTrackNumber
    ? { value: parsed.parcelTrackNumber, ok: foundInText(parsed.parcelTrackNumber, info) }
    : foundParcelTrack
      ? { value: foundParcelTrack, ok: true, note: "найден по виду номера" }
      : { value: null, ok: null };

  const missed = missedTracks(info, parsed.orders.map((o) => o.trackNumber), [r?.phone ?? null]);
  if (missed.length) warnings.push(`В тексте есть похожие на трек номера, которых нет в разборе: ${missed.join(", ")}.`);
  const notInText = [
    ...tracks.map((t) => t.track),
    ...orders.map((o) => o.name),
    ...(recipient ? [recipient.name, recipient.address, recipient.phone] : []),
  ].filter((c) => c.ok === false && c.value).length;
  if (notInText) warnings.push(`Значений, которых нет в тексте ячейки: ${notInText} — отмечены ⚠, проверьте.`);
  if (orders.some((o) => o.priceOk === false)) warnings.push("Цена не совпадает ни с одним числом в ячейке — отмечено ⚠.");
  if (groups.length && orders.some((o) => !o.group)) warnings.push("Не у всех товаров определена группа справочника наименований.");

  return {
    ok: true,
    rate,
    clientCode,
    client,
    tracks,
    recipient,
    recipientMatch,
    parcelTrack,
    warnings,
    raw: JSON.stringify(parsed.raw, null, 2).slice(0, 8000),
  };
}

/** Группы справочника наименований — секции, в которых есть товары, — и товары в них. */
async function catalogGroups(): Promise<CatalogGroup[]> {
  const rows = await prisma.productName.findMany({
    where: { deletedAt: null },
    select: { id: true, nameRu: true, parentId: true },
    orderBy: { nameRu: "asc" },
  });
  return rows
    .filter((r) => !r.parentId)
    .map((section) => ({
      group: section.nameRu,
      items: rows.filter((r) => r.parentId === section.id).slice(0, 40).map((r) => r.nameRu),
    }))
    .filter((g) => g.items.length > 0)
    .slice(0, 60);
}
