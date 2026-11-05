import "server-only";

import { prisma } from "@/lib/prisma";
import { getFinanceSettings } from "@/lib/finance";
import { activeServices, deliveryTypesByCountry, findShippingTariff } from "@/lib/tariffs";
import { EU_DUTY_END, EU_DUTY_PER_ITEM_EUR, EU_DUTY_START, EU_DUTY_VALUE_CAP_EUR } from "@/lib/eu-customs";
import { round2 } from "@/lib/purchase-money";

// Ориентировочная цена покупки «под ключ» (стратегия FOX2DOOR, раздел 6): международная доставка, услуги, пошлина.
// Всё — из тарифов и настроек в базе. Это не окончательная цена: окончательно — после взвешивания посылки.
// Тарифа нет — «рассчитает менеджер», цифры не выдумываем.

export type PurchaseServicesWanted = {
  consolidation: boolean;
  compactPack: boolean;
  standardCheck: boolean;
  detailedCheck: boolean;
  reinforcedPack: boolean;
  keepOriginal: boolean;
};

export type EstimatePart = { name: string; cny: number | null; note?: string };

export type PurchaseEstimate = {
  shippingCny: number | null; // международная доставка
  shippingNote: string; // по какому тарифу или почему не посчитано
  days: string | null; // срок по тарифу
  services: EstimatePart[];
  servicesCny: number | null; // сумма того, что посчиталось
  dutyCny: number | null;
  dutyNote: string | null;
};

export async function estimatePurchase(input: {
  countryCode: string | null;
  deliveryType: string | null;
  weightKg: number | null;
  lineCount: number;
  goodsCny: number;
  services: PurchaseServicesWanted;
}): Promise<PurchaseEstimate> {
  const finance = await getFinanceSettings();
  const rate = finance.exchangeRateCnyPerUsd;
  const weight = input.weightKg != null && input.weightKg > 0 ? input.weightKg : null;
  const tariff = await findShippingTariff(input.countryCode, input.deliveryType);
  const toCny = (usd: number) => (rate ? round2(usd * rate) : null);

  let shippingCny: number | null = null;
  let shippingNote: string;
  let billable = weight ?? 0;
  const countryTypes = input.countryCode ? (await deliveryTypesByCountry())[input.countryCode.toUpperCase()] ?? [] : [];
  if (!input.countryCode) shippingNote = "выберите страну";
  else if (!countryTypes.length) shippingNote = "в эту страну тарифа нет — рассчитает менеджер";
  else if (!input.deliveryType) shippingNote = "выберите вид доставки";
  else if (!tariff) shippingNote = "тарифа нет — рассчитает менеджер";
  else if (!weight) shippingNote = `по тарифу «${tariff.direction}»: укажите примерный вес`;
  else if (!rate) shippingNote = "курс ¥ за $ не задан — рассчитает менеджер";
  else {
    billable = Math.max(weight, Number(tariff.minWeightKg ?? 0));
    shippingCny = toCny(billable * Number(tariff.pricePerKgUsd) + Number(tariff.handlingFeeUsd));
    shippingNote = `по тарифу «${tariff.direction}», ${billable} кг — окончательно после взвешивания`;
  }
  const days = tariff?.minDays || tariff?.maxDays ? `${tariff.minDays ?? "?"}–${tariff.maxDays ?? "?"} дн.` : null;

  // Услуги — как в расчёте посылки: за кг — от веса, за заказ — за каждый товар, по факту — «по факту»
  const catalog = await activeServices();
  const wanted: [boolean, string][] = [
    [input.services.consolidation, "CONSOLIDATION"],
    [input.services.compactPack, "COMPACT_PACK"],
    [input.services.standardCheck, "STANDARD_CHECK"],
    [input.services.detailedCheck, "DETAILED_CHECK"],
    [input.services.reinforcedPack, "REINFORCED_PACK"],
    [input.services.keepOriginal, "KEEP_ORIGINAL_PACK"],
  ];
  const services: EstimatePart[] = [];
  for (const [on, code] of wanted) {
    const service = on ? catalog.get(code) : null;
    if (!service) continue;
    const value = Number(service.value ?? 0);
    if (service.pricingType === "PER_KG") {
      services.push(billable > 0 ? { name: service.name, cny: toCny(billable * value) } : { name: service.name, cny: null, note: "по весу" });
    } else if (service.pricingType === "PER_ORDER") {
      services.push({ name: service.name, cny: toCny(value * Math.max(1, input.lineCount)) });
    } else {
      services.push({ name: service.name, cny: null, note: "по факту" });
    }
  }
  const counted = services.filter((s) => s.cny != null);
  const servicesCny = counted.length ? round2(counted.reduce((sum, s) => sum + (s.cny ?? 0), 0)) : null;

  // Пошлина ЕС: €3 за вид товара, если товар дешевле €150 и мера действует (настройки «Финансы»)
  let dutyCny: number | null = null;
  let dutyNote: string | null = null;
  const country = input.countryCode ? await prisma.country.findUnique({ where: { code: input.countryCode }, select: { isEu: true } }) : null;
  const now = new Date();
  if (country?.isEu && finance.euDutyEnabled && finance.euDutyPassToClient && now >= EU_DUTY_START && now < EU_DUTY_END) {
    const eur = finance.exchangeRateCnyPerEur;
    if (eur && input.goodsCny / eur > EU_DUTY_VALUE_CAP_EUR) dutyNote = "товар дороже €150 — обычные пошлины страны, рассчитает менеджер";
    else if (eur) {
      dutyCny = round2(EU_DUTY_PER_ITEM_EUR * Math.max(1, input.lineCount) * eur);
      dutyNote = `пошлина ЕС €${EU_DUTY_PER_ITEM_EUR} за вид товара`;
    } else dutyNote = "возможна пошлина ЕС — рассчитает менеджер";
  } else if (input.countryCode && !country?.isEu) {
    dutyNote = "пошлина — по правилам страны получения, если товар дороже беспошлинного лимита";
  }

  return { shippingCny, shippingNote, days, services, servicesCny, dutyCny, dutyNote };
}
