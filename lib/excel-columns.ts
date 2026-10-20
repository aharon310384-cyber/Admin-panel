// Загрузка из Excel: что система умеет читать из строки листа и в какой колонке это лежит.
// Буквы колонок — настройка в базе (ExcelImportSettings), здесь только список полей и чтение строки. Без базы.

import { cellNumber } from "@/lib/excel-row";

export const EXCEL_FIELDS = [
  { key: "taskNumber", label: "Номер строки (задача)", required: true },
  { key: "info", label: "Большая ячейка (треки)", required: true },
  { key: "productNames", label: "Наименования" },
  { key: "quantity", label: "Количество" },
  { key: "goodsValueUsd", label: "Стоимость товаров, $" },
  { key: "weightKg", label: "Вес, кг" },
  { key: "photoReport", label: "Фотоотчёт" },
  { key: "consolidationUsd", label: "Консолидация, $" },
  { key: "packagingUsd", label: "Упаковка, $" },
  { key: "shippingUsd", label: "Стоимость отправки, $" },
  { key: "totalUsd", label: "Итого, $" },
  { key: "rate", label: "Курс ¥ за $" },
  { key: "rateEur", label: "Курс ¥ за €" },
  { key: "euItemKinds", label: "Виды товаров для Европы" },
  { key: "localDeliveryCny", label: "Локальная доставка, ¥" },
  { key: "discountPercent", label: "Скидка, %" },
  { key: "totalCny", label: "Итого, ¥" },
  { key: "paid", label: "Оплата («+»)" },
  { key: "parcelTrack", label: "Номер посылки" },
  { key: "carrierCostCny", label: "Стоимость отправки для нас, ¥ (только сотрудники)" },
  { key: "revenueCny", label: "Выручка, ¥ (только сотрудники)" },
  { key: "sentDate", label: "Дата отправки" },
  { key: "recipientName", label: "Получатель" },
  { key: "address", label: "Адрес" },
  { key: "phone", label: "Телефон" },
] as const;

export type ExcelField = (typeof EXCEL_FIELDS)[number]["key"];
export type ExcelColumns = Partial<Record<ExcelField, string>>;

const FIELD_KEYS = new Set<string>(EXCEL_FIELDS.map((f) => f.key));

/** Буква колонки → номер с нуля: A → 0, Z → 25, AA → 26. Не буква — null. */
export function columnIndex(letter: string): number | null {
  const value = letter.trim().toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(value)) return null;
  return [...value].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

/** Колонки из базы или формы: только известные поля и буквы. */
export function cleanColumns(raw: unknown): ExcelColumns {
  const result: ExcelColumns = {};
  if (!raw || typeof raw !== "object") return result;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!FIELD_KEYS.has(key) || typeof value !== "string") continue;
    const letter = value.trim().toUpperCase();
    if (columnIndex(letter) != null) result[key as ExcelField] = letter;
  }
  return result;
}

/** Похоже на номер строки (задачи): OG4283AE, SM3532US Galina. */
export function looksLikeTaskNumber(value: string | null | undefined): boolean {
  return /^[A-Za-z]{2,4}\d+[A-Za-z]{2,4}(?=$|[^A-Za-z0-9])/.test(value?.trim() ?? "");
}

/**
 * Строка скопирована целиком, с колонки A (щелчок по номеру строки в Excel), а не с колонки номера строки —
 * отрезать колонки до номера строки, чтобы первой ячейкой стал номер.
 */
export function alignRow(cells: string[], columns: ExcelColumns): string[] {
  const start = columns.taskNumber ? columnIndex(columns.taskNumber) : null;
  if (!start || looksLikeTaskNumber(cells[0]) || !looksLikeTaskNumber(cells[start])) return cells;
  return cells.slice(start);
}

/** Ячейка поля: строку копируют с колонки номера строки, она — первая ячейка. */
export function cellOf(cells: string[], columns: ExcelColumns, field: ExcelField): string | null {
  const start = columns.taskNumber ? columnIndex(columns.taskNumber) : null;
  const at = columns[field] ? columnIndex(columns[field]!) : null;
  if (start == null || at == null || at < start) return null;
  const value = cells[at - start]?.trim();
  return value ? value : null;
}

/** Число поля; «0», пусто и не число — null там, где ноль ничего не значит (услуги, суммы). */
export function numberOf(cells: string[], columns: ExcelColumns, field: ExcelField): number | null {
  return cellNumber(cellOf(cells, columns, field));
}

/** Дата отправки: «2026.10.07», «2026-10-07», «07.10.2026». Неполная («2026.10.xx») — null. Полдень UTC, чтобы день не съехал. */
export function sentDateOf(value: string | null): Date | null {
  const text = value?.trim() ?? "";
  let match = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/.exec(text);
  const [y, m, d] = match
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : (match = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(text))
      ? [Number(match[3]), Number(match[2]), Number(match[1])]
      : [0, 0, 0];
  if (!y) return null;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/** Наименования из ячейки: через запятую, точку с запятой или с новой строки; «Сумка #3211-А» → товар «Сумка», комментарий «#3211-А». */
export function productItems(value: string | null): { name: string; comment: string | null }[] {
  return (value ?? "")
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(.*?)\s*(#\S.*)$/.exec(part);
      return match && match[1].trim() ? { name: match[1].trim(), comment: match[2] } : { name: part, comment: null };
    });
}

/** Отметка «оплачено»: «+», «да», «оплачено». */
export function isPaidMark(value: string | null): boolean {
  return /^(\+|да|yes|оплачено|paid)$/i.test(value?.trim() ?? "");
}
