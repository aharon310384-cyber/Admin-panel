// Деньги покупки, ¥: строки, комиссия, итог. Общий модуль для сервера и браузера (форма цены и корзина считают так же).
// Процент и минимум комиссии — из настроек покупки (PurchaseSettings), здесь чисел компании нет.

/** До фэней; −0 → 0, чтобы не показывать «¥-0,00». */
export const round2 = (value: number) => Math.round(value * 100) / 100 + 0;

export type CommissionRule = { percent: number | null; minCny: number | null };

/** Комиссия: процент от суммы товара, но не меньше минимума. Процент не задан в настройках — null. */
export function commissionFor(goodsCny: number, rule: CommissionRule): number | null {
  if (rule.percent == null) return null;
  if (goodsCny <= 0) return 0;
  const byPercent = round2((goodsCny * rule.percent) / 100);
  return round2(Math.max(byPercent, rule.minCny ?? 0));
}

export type MoneyLine = { status?: string; quantity: number; unitPriceCny: number | null; chinaDeliveryCny: number | null };

/** Строка в цене покупки: всё, кроме отказа. Возвращённые остаются — их купили, деньги по возврату идут отдельно. */
export const countsInPrice = (line: { status?: string }) => line.status !== "REJECTED";

/**
 * Итог покупки по строкам: товар, доставка по Китаю, комиссия (по настройкам или вручную), итого.
 * missingPrice — у какой-то строки нет цены: итог не окончательный.
 */
export function purchaseTotals(lines: MoneyLine[], commission: { manual: number | null; rule: CommissionRule }) {
  const priced = lines.filter(countsInPrice);
  const goodsCny = round2(priced.reduce((sum, l) => sum + (l.unitPriceCny ?? 0) * l.quantity, 0));
  const chinaDeliveryCny = round2(priced.reduce((sum, l) => sum + (l.chinaDeliveryCny ?? 0), 0));
  const commissionCny = commission.manual ?? commissionFor(goodsCny, commission.rule);
  const totalCny = commissionCny == null ? null : round2(goodsCny + chinaDeliveryCny + commissionCny);
  const missingPrice = priced.some((l) => l.unitPriceCny == null || l.unitPriceCny <= 0);
  return { goodsCny, chinaDeliveryCny, commissionCny, totalCny, missingPrice, count: priced.length };
}

/** «12,5» и «12.5» → 12.5; пусто или не число — null. */
export function parseMoney(value: FormDataEntryValue | string | null | undefined): number | null {
  if (value == null || typeof value !== "string") return null;
  const text = value.replace(/\s+/g, "").replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? round2(number) : null;
}

const cnyFormat = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ¥1 234,50 */
export function yuan(value: number | string | { toString(): string } | null | undefined): string {
  if (value == null) return "—";
  const number = Number(value);
  return Number.isFinite(number) ? `¥${cnyFormat.format(number + 0)}` : "—";
}

/** «2 ч 15 мин», «3 дн 4 ч» — сколько занял шаг. */
export function duration(from: Date | string, to: Date | string): string {
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч${minutes % 60 ? ` ${minutes % 60} мин` : ""}`;
  const days = Math.floor(hours / 24);
  return `${days} дн${hours % 24 ? ` ${hours % 24} ч` : ""}`;
}
