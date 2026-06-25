/**
 * Таможенная пошлина ЕС на мелкие посылки.
 * Основание: Council Regulation (EU) 2026/382 — отмена de minimis и временная
 * фиксированная пошлина €3 за каждую тарифную позицию (per item, по классификации,
 * НЕ за штуку и НЕ за посылку) для отправлений стоимостью до €150.
 * Действует с 01.07.2026 до 01.07.2028, далее — обычные тарифы.
 *
 * Чистый модуль без обращения к БД — единый источник правды для actions и расчётчика.
 */

export const EU_DUTY_PER_ITEM_EUR = 3; // €3 за тарифную позицию
export const EU_DUTY_VALUE_CAP_EUR = 150; // применяется только до €150 включительно
export const EU_DUTY_START = new Date("2026-07-01T00:00:00Z");
export const EU_DUTY_END = new Date("2028-07-01T00:00:00Z");

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Минимальная форма строки-заказа для подсчёта тарифных позиций. */
export type DutyOrderLine = {
  hsCode?: string | null;
  productNameId?: string | null;
  productNameText?: string | null;
};

/**
 * Число РАЗНЫХ тарифных позиций в посылке. База — HS-код; пока HS не заполнены,
 * fallback на наименование (id → текст). Одинаковые товары = одна позиция.
 */
export function countDistinctTariffLines(orders: DutyOrderLine[]): number {
  const keys = new Set<string>();
  for (const o of orders) {
    const key =
      (o.hsCode && o.hsCode.trim()) ||
      (o.productNameId && `id:${o.productNameId}`) ||
      (o.productNameText && `txt:${o.productNameText.trim().toLowerCase()}`) ||
      null;
    // строки без всякой идентификации считаем как одну отдельную позицию каждая
    keys.add(key ?? `anon:${keys.size}`);
  }
  return keys.size;
}

/** true, если HS-коды заполнены не у всех строк (подсчёт по наименованиям — предупредить). */
export function hasIncompleteHsCodes(orders: DutyOrderLine[]): boolean {
  return orders.some((o) => !o.hsCode || !o.hsCode.trim());
}

export type DutyInput = {
  enabled: boolean; // мастер-выключатель меры (FinanceSettings)
  destinationIsEu: boolean; // страна получателя входит в ЕС
  declaredValueUsd: number; // сумма объявленных стоимостей строк, $
  exchangeRateUsdPerEur: number; // курс EUR ($ за €)
  orders: DutyOrderLine[];
  now?: Date; // момент расчёта (по умолчанию текущий) — прокси даты отправки
};

export type DutyResult = {
  applies: boolean; // попадает ли посылка под €3-пошлину
  lineCount: number; // число тарифных позиций
  dutyEur: number; // сумма пошлины в €
  dutyUsd: number; // сумма пошлины в $
  reason?: "not-enabled" | "not-eu" | "no-orders" | "out-of-window" | "over-cap";
};

/** Рассчитать таможенную пошлину ЕС для посылки. */
export function computeEuCustomsDuty(input: DutyInput): DutyResult {
  const { enabled, destinationIsEu, declaredValueUsd, exchangeRateUsdPerEur, orders } = input;
  const now = input.now ?? new Date();
  const none = (reason: DutyResult["reason"]): DutyResult => ({
    applies: false, lineCount: 0, dutyEur: 0, dutyUsd: 0, reason,
  });

  if (!enabled) return none("not-enabled");
  if (!destinationIsEu) return none("not-eu");
  if (now < EU_DUTY_START || now >= EU_DUTY_END) return none("out-of-window");
  if (orders.length === 0) return none("no-orders");

  // порог €150: переводим объявленную стоимость из $ в €
  const rate = exchangeRateUsdPerEur > 0 ? exchangeRateUsdPerEur : 1;
  const declaredEur = declaredValueUsd / rate;
  // > €150 — режим обычных пошлин, фиксированный €3 не применяется
  if (declaredEur > EU_DUTY_VALUE_CAP_EUR) return none("over-cap");

  const lineCount = countDistinctTariffLines(orders);
  const dutyEur = round2(lineCount * EU_DUTY_PER_ITEM_EUR);
  const dutyUsd = round2(dutyEur * rate);
  return { applies: true, lineCount, dutyEur, dutyUsd };
}
