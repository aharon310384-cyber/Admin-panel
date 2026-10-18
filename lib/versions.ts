// «История изменений» документов — как версионирование объектов в 1С. Только сервер.
// Версия — снимок реквизитов и табличных частей документа, значения уже строками для показа
// (имена, а не id). При изменении документа: ensureBaseline → изменение → recordVersion,
// в транзакции — с её tx. Версия пишется, только если снимок отличается от последней версии.
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCny, formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import { deliveryTypeLabel, orderStatusLabel, parcelStatusLabel } from "@/lib/statuses";

type Db = PrismaClient | Prisma.TransactionClient;

export type VersionEntity = "order" | "parcel";
export const VERSION_ENTITIES: VersionEntity[] = ["order", "parcel"];

export function isVersionEntity(value: string): value is VersionEntity {
  return (VERSION_ENTITIES as string[]).includes(value);
}

export type VersionField = { key: string; label: string; value: string };
export type VersionTable = { key: string; label: string; columns: string[]; rows: string[][] };
export type VersionData = { fields: VersionField[]; tables: VersionTable[] };

export const BASELINE_COMMENT = "Исходное состояние";

// ── Значения для показа

const EMPTY = "—";
type Num = number | { toNumber(): number } | null | undefined;

const text = (value: string | null | undefined) => value?.trim() || EMPTY;
const yesNo = (value: boolean) => (value ? "Да" : "Нет");
const num = (value: Num) => (value == null ? EMPTY : formatNumber(Number(value)));
const usd = (value: Num) => (value == null ? EMPTY : formatUsd(value));
const cny = (value: Num) => (value == null ? EMPTY : formatCny(value));
const date = (value: Date | null | undefined) => (value ? formatDateTime(value) : EMPTY);
const client = (customer: { code: string | null; name: string }) =>
  [customer.code, customer.name].filter(Boolean).join(" ") || EMPTY;

const field = (key: string, label: string, value: string): VersionField => ({ key, label, value });

const PAYMENT_TIMING: Record<string, string> = { BEFORE: "До отправки", FLEXIBLE: "До или после отправки" };

// ── Снимки

const ORDER_INCLUDE = {
  customer: { select: { code: true, name: true } },
  recipient: { select: { name: true } },
  author: { select: { name: true } },
  sorting: { select: { number: true } },
  receiving: { select: { number: true } },
  parcelTask: { select: { number: true } },
  parcel: { select: { number: true } },
} satisfies Prisma.OrderInclude;

const PARCEL_INCLUDE = {
  customer: { select: { code: true, name: true } },
  recipient: { select: { name: true } },
  parcelTask: { select: { number: true } },
  box: { select: { number: true } },
  services: { orderBy: { id: "asc" } },
  orders: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { number: true, productNameText: true, trackNumber: true },
  },
} satisfies Prisma.ParcelInclude;

type OrderDoc = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;
type ParcelDoc = Prisma.ParcelGetPayload<{ include: typeof PARCEL_INCLUDE }>;

function orderData(o: OrderDoc): VersionData {
  return {
    fields: [
      field("number", "Номер", text(o.number)),
      field("date", "Дата", date(o.createdAt)),
      field("customer", "Клиент", client(o.customer)),
      field("recipient", "Получатель", text(o.recipient?.name)),
      field("productName", "Наименование", text(o.productNameText)),
      field("category", "Категория", text(o.category)),
      field("hsCode", "Код ТН ВЭД", text(o.hsCode)),
      field("trackNumber", "Входящий трек-номер", text(o.trackNumber)),
      field("quantity", "Количество", String(o.quantity)),
      field("unitPriceCny", "Цена, ¥", cny(o.unitPriceCny)),
      field("unitPriceUsd", "Цена, $", usd(o.unitPriceUsd)),
      field("declaredValueUsd", "Объявленная стоимость, $", usd(o.declaredValueUsd)),
      field("actualWeightKg", "Фактический вес, кг", num(o.actualWeightKg)),
      field("volumetricWeightKg", "Объёмный вес, кг", num(o.volumetricWeightKg)),
      field("deliveryType", "Вид доставки", o.deliveryType ? deliveryTypeLabel(o.deliveryType) : EMPTY),
      field("status", "Статус", orderStatusLabel(o.status)),
      field("detailedCheck", "Детальная проверка и фотоотчёт", yesNo(o.detailedCheckRequested)),
      field("keepOriginalPackaging", "Оставить оригинальную упаковку", yesNo(o.keepOriginalPackaging)),
      field("consolidation", "Консолидация", yesNo(o.consolidationRequested)),
      field("compactPack", "Компактная упаковка", yesNo(o.compactPackRequested)),
      field("standardCheck", "Стандартная проверка на соответствие", yesNo(o.standardCheckRequested)),
      field("reinforcedPack", "Усиленная упаковка", yesNo(o.reinforcedPackRequested)),
      field("productUrl", "Ссылка на товар", text(o.productUrl)),
      field("imageUrl", "Изображение", text(o.imageUrl)),
      field("customerComment", "Комментарий клиента", text(o.customerComment)),
      field("sorting", "Сортировка", text(o.sorting?.number)),
      field("receiving", "Приём заказа", text(o.receiving?.number)),
      field("parcelTask", "Задача", text(o.parcelTask?.number)),
      field("parcel", "Посылка", text(o.parcel?.number)),
      field("author", "Автор", text(o.author?.name)),
      field("deleted", "Помечен на удаление", yesNo(Boolean(o.deletedAt))),
    ],
    tables: [],
  };
}

function parcelData(p: ParcelDoc): VersionData {
  const dims = [p.lengthCm, p.widthCm, p.heightCm];
  const passToClient = p.customsDutyPassToClient == null ? "Как в настройках" : yesNo(p.customsDutyPassToClient);
  return {
    fields: [
      field("number", "Номер", text(p.number)),
      field("date", "Дата", date(p.createdAt)),
      field("parcelTask", "Задача", text(p.parcelTask?.number)),
      field("customer", "Клиент", client(p.customer)),
      field("recipient", "Получатель", text(p.recipient?.name)),
      field("deliveryType", "Вид доставки", p.deliveryType ? deliveryTypeLabel(p.deliveryType) : EMPTY),
      field("status", "Статус", parcelStatusLabel(p.status)),
      field("trackingNumber", "Трек-номер посылки", text(p.trackingNumber)),
      field("actualWeightKg", "Фактический вес, кг", num(p.actualWeightKg)),
      field("volumetricWeightKg", "Объёмный вес, кг", num(p.volumetricWeightKg)),
      field("billableWeightKg", "Расчётный вес, кг", num(p.billableWeightKg)),
      field("dimensions", "Габариты Д×Ш×В, см", dims.some((d) => d != null) ? dims.map(num).join(" × ") : EMPTY),
      field("exchangeRate", "Курс, ¥ за $", num(p.exchangeRateCnyPerUsd)),
      field("shippingCostUsd", "Отправка, $", usd(p.shippingCostUsd)),
      field("discountPercent", "Скидка, %", num(p.discountPercent)),
      field("customsDutyEur", "Пошлина ЕС, €", num(p.customsDutyEur)),
      field("customsDutyUsd", "Пошлина ЕС, $", usd(p.customsDutyUsd)),
      field("customsDutyLineCount", "Позиций для пошлины", num(p.customsDutyLineCount)),
      field("customsDutyManualLines", "Позиций для пошлины вручную", num(p.customsDutyManualLines)),
      field("customsDutyPassToClient", "Пошлина в счёт клиента", passToClient),
      field("totalUsd", "Итого, $", usd(p.totalUsd)),
      field("totalCny", "Итого, ¥", cny(p.totalCny)),
      field("paymentTiming", "Оплата", PAYMENT_TIMING[p.paymentTiming] ?? p.paymentTiming),
      field("isPaid", "Оплачено", yesNo(p.isPaid)),
      field("paidAt", "Дата оплаты", date(p.paidAt)),
      field("box", "Короб", text(p.box?.number)),
      field("notes", "Примечание", text(p.notes)),
      field("deleted", "Помечена на удаление", yesNo(Boolean(p.deletedAt))),
    ],
    tables: [
      {
        key: "services",
        label: "Услуги",
        columns: ["Код", "Услуга", "Цена, $", "Цена, ¥"],
        rows: p.services.map((s) => [s.serviceCode, text(s.name), usd(s.priceUsd), cny(s.priceCny)]),
      },
      {
        key: "orders",
        label: "Заказы",
        columns: ["Номер", "Наименование", "Входящий трек-номер"],
        rows: p.orders.map((o) => [text(o.number), text(o.productNameText), text(o.trackNumber)]),
      },
    ],
  };
}

type Snapshot = { data: VersionData; authorId: string | null; updatedAt: Date };

// Снимки нескольких документов одним запросом (в транзакции — с её незафиксированными изменениями).
async function snapshots(entity: VersionEntity, ids: string[], db: Db): Promise<Map<string, Snapshot>> {
  const result = new Map<string, Snapshot>();
  if (entity === "order") {
    const orders = await db.order.findMany({ where: { id: { in: ids } }, include: ORDER_INCLUDE });
    for (const o of orders) result.set(o.id, { data: orderData(o), authorId: o.authorId, updatedAt: o.updatedAt });
  } else {
    const parcels = await db.parcel.findMany({ where: { id: { in: ids } }, include: PARCEL_INCLUDE });
    for (const p of parcels) result.set(p.id, { data: parcelData(p), authorId: null, updatedAt: p.updatedAt });
  }
  return result;
}

// ── Сравнение снимков

// JSON с ключами по алфавиту: jsonb в PostgreSQL хранит ключи объектов в своём порядке.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(obj[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const sameData = (a: unknown, b: unknown) => canonical(a) === canonical(b);

// Снимок из базы — к виду VersionData (без падений на чужом или старом формате).
export function parseVersionData(json: Prisma.JsonValue): VersionData {
  const raw = (json && typeof json === "object" && !Array.isArray(json) ? json : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? EMPTY : String(v));
  const fields = (Array.isArray(raw.fields) ? raw.fields : []).map((f) => {
    const item = (f ?? {}) as Record<string, unknown>;
    return { key: str(item.key), label: str(item.label), value: str(item.value) };
  });
  const tables = (Array.isArray(raw.tables) ? raw.tables : []).map((t) => {
    const item = (t ?? {}) as Record<string, unknown>;
    return {
      key: str(item.key),
      label: str(item.label),
      columns: (Array.isArray(item.columns) ? item.columns : []).map(str),
      rows: (Array.isArray(item.rows) ? item.rows : []).map((row) => (Array.isArray(row) ? row.map(str) : [str(row)])),
    };
  });
  return { fields, tables };
}

// Ключи реквизитов и табличных частей, которые отличаются от предыдущей версии.
// У первой версии — всё заполненное.
function changedKeys(prev: VersionData | null, cur: VersionData): string[] {
  const keys: string[] = [];
  const prevFields = new Map(prev?.fields.map((f) => [f.key, f.value]));
  for (const f of cur.fields) {
    if (prev ? prevFields.get(f.key) !== f.value : f.value !== EMPTY) keys.push(f.key);
  }
  const prevTables = new Map(prev?.tables.map((t) => [t.key, t.rows]));
  for (const t of cur.tables) {
    if (prev ? !sameData(prevTables.get(t.key) ?? [], t.rows) : t.rows.length > 0) keys.push(t.key);
  }
  return keys;
}

// ── Запись версий

type VersionOpts = { authorId?: string | null; comment?: string | null };

// Автор пишется, только если пользователь есть в базе: сессия может ссылаться на устаревший User.id.
async function existingUserId(id: string | null | undefined, db: Db): Promise<string | null> {
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  return user?.id ?? null;
}

/** Записать новую версию документов, у которых снимок отличается от последней версии. */
export async function recordVersions(
  entity: VersionEntity,
  ids: string[],
  { authorId, comment }: VersionOpts,
  db: Db = prisma
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const docs = await snapshots(entity, unique, db);
  if (docs.size === 0) return;
  const last = await db.objectVersion.findMany({
    where: { entity, entityId: { in: [...docs.keys()] } },
    orderBy: [{ entityId: "asc" }, { version: "desc" }],
    distinct: ["entityId"],
    select: { entityId: true, version: true, data: true },
  });
  const lastById = new Map(last.map((v) => [v.entityId, v]));
  const author = await existingUserId(authorId, db);

  const rows: Prisma.ObjectVersionCreateManyInput[] = [];
  for (const [entityId, doc] of docs) {
    const prev = lastById.get(entityId);
    if (prev && sameData(prev.data, doc.data)) continue;
    rows.push({
      entity,
      entityId,
      version: (prev?.version ?? 0) + 1,
      authorId: author,
      comment: comment ?? null,
      data: doc.data,
    });
  }
  // skipDuplicates: если версию с тем же номером успел записать параллельный запрос, действие не падает.
  if (rows.length) await db.objectVersion.createMany({ data: rows, skipDuplicates: true });
}

/** Записать новую версию документа, если он изменился с последней версии. */
export async function recordVersion(
  entity: VersionEntity,
  id: string,
  opts: VersionOpts,
  db: Db = prisma
): Promise<void> {
  await recordVersions(entity, [id], opts, db);
}

/**
 * Документам без истории — текущее состояние как версия 1 («Исходное состояние»): автор документа,
 * дата — последнее изменение документа. Вызывать перед изменением, чтобы первое изменение было с чем сравнить.
 */
export async function ensureBaselines(entity: VersionEntity, ids: string[], db: Db = prisma): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const existing = await db.objectVersion.findMany({
    where: { entity, entityId: { in: unique } },
    distinct: ["entityId"],
    select: { entityId: true },
  });
  const have = new Set(existing.map((v) => v.entityId));
  const missing = unique.filter((id) => !have.has(id));
  if (missing.length === 0) return;
  const docs = await snapshots(entity, missing, db);
  const rows: Prisma.ObjectVersionCreateManyInput[] = [...docs].map(([entityId, doc]) => ({
    entity,
    entityId,
    version: 1,
    authorId: doc.authorId,
    comment: BASELINE_COMMENT,
    data: doc.data,
    createdAt: doc.updatedAt,
  }));
  if (rows.length) await db.objectVersion.createMany({ data: rows, skipDuplicates: true });
}

/** Документу без истории — текущее состояние как версия 1. Вызывать перед изменением. */
export async function ensureBaseline(entity: VersionEntity, id: string, db: Db = prisma): Promise<void> {
  await ensureBaselines(entity, [id], db);
}

// ── Чтение для страниц

/** «Заказ ZK-000012 (JT5516485420008)» / «Посылка PS-000001 (трек)»; null — документа нет. */
export async function documentTitle(entity: VersionEntity, id: string): Promise<string | null> {
  if (entity === "order") {
    const order = await prisma.order.findUnique({ where: { id }, select: { number: true, trackNumber: true } });
    if (!order) return null;
    return `Заказ ${order.number ?? "без номера"}${order.trackNumber ? ` (${order.trackNumber})` : ""}`;
  }
  const parcel = await prisma.parcel.findUnique({ where: { id }, select: { number: true, trackingNumber: true } });
  if (!parcel) return null;
  return `Посылка ${parcel.number}${parcel.trackingNumber ? ` (${parcel.trackingNumber})` : ""}`;
}

export type VersionItem = {
  version: number;
  authorName: string | null;
  createdAt: Date;
  comment: string | null;
  data: VersionData;
  prev: number | null; // предыдущая версия
  changed: string[]; // ключи реквизитов и табличных частей, изменённых относительно предыдущей версии
};

/** Версии документа, новые сверху. */
export async function listVersions(entity: VersionEntity, id: string): Promise<VersionItem[]> {
  const rows = await prisma.objectVersion.findMany({
    where: { entity, entityId: id },
    orderBy: { version: "asc" },
    include: { author: { select: { name: true } } },
  });
  let prev: { version: number; data: VersionData } | null = null;
  const items: VersionItem[] = [];
  for (const row of rows) {
    const data = parseVersionData(row.data);
    items.push({
      version: row.version,
      authorName: row.author?.name ?? null,
      createdAt: row.createdAt,
      comment: row.comment,
      data,
      prev: prev?.version ?? null,
      changed: changedKeys(prev?.data ?? null, data),
    });
    prev = { version: row.version, data };
  }
  return items.reverse();
}

export type VersionDetails = Omit<VersionItem, "changed"> & { last: boolean };

/** Одна версия документа; null — такой нет. */
export async function getVersion(entity: VersionEntity, id: string, version: number): Promise<VersionDetails | null> {
  const row = await prisma.objectVersion.findUnique({
    where: { entity_entityId_version: { entity, entityId: id, version } },
    include: { author: { select: { name: true } } },
  });
  if (!row) return null;
  const [before, after] = await Promise.all([
    prisma.objectVersion.findFirst({
      where: { entity, entityId: id, version: { lt: version } },
      orderBy: { version: "desc" },
      select: { version: true },
    }),
    prisma.objectVersion.count({ where: { entity, entityId: id, version: { gt: version } } }),
  ]);
  return {
    version: row.version,
    authorName: row.author?.name ?? null,
    createdAt: row.createdAt,
    comment: row.comment,
    data: parseVersionData(row.data),
    prev: before?.version ?? null,
    last: after === 0,
  };
}

export type FieldDiff = { key: string; label: string; a: string; b: string; changed: boolean };
export type RowDiff = { a: string[] | null; b: string[] | null; changed: boolean };
export type TableDiff = { key: string; label: string; columns: string[]; rows: RowDiff[]; changed: boolean };
export type VersionHead = { version: number; authorName: string | null; createdAt: Date; comment: string | null };
export type VersionComparison = { a: VersionHead; b: VersionHead; fields: FieldDiff[]; tables: TableDiff[] };

// Строки табличной части сопоставляются по первому столбцу (код услуги, номер заказа), а не по номеру строки:
// после пересчёта строки могут встать в другом порядке. Повторы ключа различаются по порядку появления.
function keyedRows(rows: string[][]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = row[0] ?? "";
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    result.set(`${key}\u0000${n}`, row);
  }
  return result;
}

function diffTable(a: VersionTable | undefined, b: VersionTable | undefined): TableDiff {
  const base = (a ?? b)!;
  const rowsA = keyedRows(a?.rows ?? []);
  const rowsB = keyedRows(b?.rows ?? []);
  const keys = [...new Set([...rowsA.keys(), ...rowsB.keys()])];
  const rows = keys.map((key) => {
    const ra = rowsA.get(key) ?? null;
    const rb = rowsB.get(key) ?? null;
    return { a: ra, b: rb, changed: !ra || !rb || !sameData(ra, rb) };
  });
  return { key: base.key, label: base.label, columns: base.columns, rows, changed: rows.some((r) => r.changed) };
}

/** Сравнение двух версий: реквизит, значение в версии a, в версии b, различается ли. */
export async function compareVersions(
  entity: VersionEntity,
  id: string,
  a: number,
  b: number
): Promise<VersionComparison | null> {
  const rows = await prisma.objectVersion.findMany({
    where: { entity, entityId: id, version: { in: [a, b] } },
    include: { author: { select: { name: true } } },
  });
  const va = rows.find((r) => r.version === a);
  const vb = rows.find((r) => r.version === b);
  if (!va || !vb) return null;
  const dataA = parseVersionData(va.data);
  const dataB = parseVersionData(vb.data);
  const head = (r: typeof va): VersionHead => ({
    version: r.version,
    authorName: r.author?.name ?? null,
    createdAt: r.createdAt,
    comment: r.comment,
  });

  const fieldsA = new Map(dataA.fields.map((f) => [f.key, f]));
  const fieldsB = new Map(dataB.fields.map((f) => [f.key, f]));
  const fieldKeys = [...new Set([...fieldsA.keys(), ...fieldsB.keys()])];
  const fields = fieldKeys.map((key) => {
    const fa = fieldsA.get(key);
    const fb = fieldsB.get(key);
    const valueA = fa?.value ?? EMPTY;
    const valueB = fb?.value ?? EMPTY;
    return { key, label: (fa ?? fb)!.label, a: valueA, b: valueB, changed: valueA !== valueB };
  });

  const tablesA = new Map(dataA.tables.map((t) => [t.key, t]));
  const tablesB = new Map(dataB.tables.map((t) => [t.key, t]));
  const tableKeys = [...new Set([...tablesA.keys(), ...tablesB.keys()])];
  const tables = tableKeys.map((key) => diffTable(tablesA.get(key), tablesB.get(key)));

  return { a: head(va), b: head(vb), fields, tables };
}
