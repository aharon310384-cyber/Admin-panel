// Подписи тарифов и услуг для страниц тарифов и форм. Общий модуль для сервера и браузера: без обращения к базе.
import type { ServicePricingType } from "@prisma/client";

type Num = number | { toNumber(): number } | null | undefined;
const num = (value: Num) => (value == null ? null : Number(value));

export type ShippingPriceFields = { pricePerKgUsd: Num; handlingFeeUsd: Num; onRequest: boolean };
export type ServicePriceFields = { pricingType: ServicePricingType; value: Num; percentMin: Num; percentMax: Num };

export function formatShippingPrice(tariff: ShippingPriceFields): string {
  if (tariff.onRequest) return "По запросу";
  return `${num(tariff.pricePerKgUsd)}$/кг + ${num(tariff.handlingFeeUsd) ?? 0}$ оформление`;
}

export function formatTariffDays(tariff: { minDays: number | null; maxDays: number | null }): string {
  if (tariff.minDays == null || tariff.maxDays == null) return "по запросу";
  return `${tariff.minDays}-${tariff.maxDays} дней`;
}

export const PRICING_TYPE_LABELS: Record<ServicePricingType, string> = {
  PER_KG: "за кг расчётного веса",
  PER_ORDER: "за заказ (лот)",
  PERCENT: "% от стоимости товара",
  MANUAL: "по факту",
};

/** Цена услуги: «0.5$/кг», «2$/лот», «2-10%», «по факту». */
export function formatServicePrice(service: ServicePriceFields): string {
  const value = num(service.value) ?? 0;
  switch (service.pricingType) {
    case "PER_KG":
      return `${value}$/кг`;
    case "PER_ORDER":
      return `${value}$/лот`;
    case "PERCENT":
      return `${num(service.percentMin) ?? 0}-${num(service.percentMax) ?? 0}%`;
    case "MANUAL":
      return "по факту";
  }
}

/** Подсказки к отметкам услуг в формах: код услуги → «0.3$/кг». */
export type ServiceHints = Record<string, string>;

/** Список стран под направлением; не нужен, если название направления уже называет все страны. */
export function countriesNote(codes: string[], direction: string, names: Map<string, string>): string | null {
  const list = codes.map((code) => names.get(code) ?? code);
  const title = direction.toLowerCase();
  if (!list.length || list.every((name) => title.includes(name.toLowerCase()))) return null;
  return list.join(", ");
}
