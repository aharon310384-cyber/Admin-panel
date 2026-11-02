// Деньги выкупа, ¥: комиссия и итог. Общий модуль для сервера и браузера (форма «Назначить цену» считает так же).
// Процент и минимум комиссии — из настроек выкупа (BuyoutSettings), здесь чисел компании нет.

/** До копеек (фэней); −0 → 0, чтобы не показывать «¥-0,00». */
export const round2 = (value: number) => Math.round(value * 100) / 100 + 0;

export type CommissionRule = { percent: number | null; minCny: number | null };

/** Комиссия: процент от суммы товара, но не меньше минимума. Процент не задан в настройках — null. */
export function commissionFor(goodsCny: number, rule: CommissionRule): number | null {
  if (rule.percent == null) return null;
  const byPercent = round2((goodsCny * rule.percent) / 100);
  return round2(Math.max(byPercent, rule.minCny ?? 0));
}

/** Товар = цена × количество; итого = товар + доставка по Китаю + комиссия. */
export function buyoutTotals(input: { unitPriceCny: number; quantity: number; chinaDeliveryCny: number; commissionCny: number }) {
  const goodsCny = round2(input.unitPriceCny * input.quantity);
  const totalCny = round2(goodsCny + input.chinaDeliveryCny + input.commissionCny);
  return { goodsCny, totalCny };
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
  return Number.isFinite(number) ? `¥${cnyFormat.format(number)}` : "—";
}
