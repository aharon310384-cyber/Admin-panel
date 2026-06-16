export type TransportMode = "auto" | "air" | "sea" | "ems" | "request";
export type PricingType =
  | "per_kg_plus_fee"
  | "per_kg"
  | "per_lot"
  | "percent_range"
  | "actual";

export type ShippingTariff = {
  title: string;
  destination: string;
  mode: TransportMode;
  pricePerKgUsd: number | null;
  handlingFeeUsd: number | null;
  minDays: number | null;
  maxDays: number | null;
  deliveryTarget: string;
  cargoType?: string;
  onRequest?: boolean;
};

export type AdditionalServiceTariff = {
  title: string;
  description: string;
  pricingType: PricingType;
  priceUsd: number | null;
  minPercent?: number;
  maxPercent?: number;
  unit: string;
};

export const POSTMANFOX_TARIFF_SOURCE = {
  url: "https://postmanfox.com/ru/tarify/",
  title: "Тарифы на доставку из Китая | Postman Fox",
  accessedAt: "2026-05-02",
  pageModifiedAt: "2025-03-08",
};

export const MAIN_SHIPPING_TARIFFS: ShippingTariff[] = [
  {
    title: "Россия (авто)",
    destination: "Россия",
    mode: "auto",
    pricePerKgUsd: 15,
    handlingFeeUsd: 5,
    minDays: 15,
    maxDays: 25,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "Украина (авиа)",
    destination: "Украина",
    mode: "air",
    pricePerKgUsd: 18,
    handlingFeeUsd: 2,
    minDays: 15,
    maxDays: 25,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "Украина (море)",
    destination: "Украина",
    mode: "sea",
    pricePerKgUsd: 7.5,
    handlingFeeUsd: 2,
    minDays: 50,
    maxDays: 65,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "Узбекистан (авиа), простые товары",
    destination: "Узбекистан",
    mode: "air",
    pricePerKgUsd: 13,
    handlingFeeUsd: 2,
    minDays: 10,
    maxDays: 15,
    deliveryTarget: "до двери/отделения",
    cargoType: "простые товары",
  },
  {
    title: "Узбекистан (авиа), порошки, жидкости, батарейки",
    destination: "Узбекистан",
    mode: "air",
    pricePerKgUsd: 15,
    handlingFeeUsd: 2,
    minDays: 10,
    maxDays: 15,
    deliveryTarget: "до двери/отделения",
    cargoType: "порошки, жидкости, батарейки",
  },
  {
    title: "Казахстан (авто)",
    destination: "Казахстан",
    mode: "auto",
    pricePerKgUsd: 7.5,
    handlingFeeUsd: 2,
    minDays: 15,
    maxDays: 18,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "Беларусь (авто)",
    destination: "Беларусь",
    mode: "auto",
    pricePerKgUsd: 15,
    handlingFeeUsd: 3,
    minDays: 15,
    maxDays: 25,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "Молдова (до 2 кг)",
    destination: "Молдова",
    mode: "auto",
    pricePerKgUsd: 20,
    handlingFeeUsd: 5,
    minDays: 15,
    maxDays: 25,
    deliveryTarget: "до двери/отделения",
    cargoType: "до 2 кг",
  },
];

export const EMS_SHIPPING_TARIFFS: ShippingTariff[] = [
  {
    title: "Южная Корея, Япония",
    destination: "Южная Корея, Япония",
    mode: "ems",
    pricePerKgUsd: 11,
    handlingFeeUsd: 12,
    minDays: 10,
    maxDays: 18,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "Таиланд, Филиппины, Индонезия, Вьетнам, Камбоджа, Малайзия, Сингапур",
    destination: "Таиланд, Филиппины, Индонезия, Вьетнам, Камбоджа, Малайзия, Сингапур",
    mode: "ems",
    pricePerKgUsd: 12,
    handlingFeeUsd: 15,
    minDays: 10,
    maxDays: 18,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "Австралия, Новая Зеландия",
    destination: "Австралия, Новая Зеландия",
    mode: "ems",
    pricePerKgUsd: 13,
    handlingFeeUsd: 20,
    minDays: 12,
    maxDays: 20,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "Европа и Грузия",
    destination: "Германия, Франция, Италия, Испания, Австрия, Бельгия, Великобритания, Дания, Финляндия, Греция, Ирландия, Люксембург, Португалия, Швеция, Польша, Чехия, Венгрия, Румыния, Хорватия, Латвия, Литва, Эстония, Грузия",
    mode: "ems",
    pricePerKgUsd: 15,
    handlingFeeUsd: 25,
    minDays: 12,
    maxDays: 20,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "ОАЭ, Америка, Канада, Россия и др.",
    destination: "ОАЭ, Иордания, Марокко, ЮАР, Аргентина, Бразилия, Колумбия, Панама, Перу, Куба, Мексика, Канада, Кипр, Мальта, Норвегия, Швейцария, Россия",
    mode: "ems",
    pricePerKgUsd: 20,
    handlingFeeUsd: 25,
    minDays: 15,
    maxDays: 25,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "Индия, Турция, Пакистан, Катар, Оман, Кения и др.",
    destination: "Индия, Турция, Пакистан, Бангладеш, Шри-Ланка, Непал, Лаос, Катар, Бахрейн, Кувейт, Тунис, Оман, Кения, Сенегал, Уганда",
    mode: "ems",
    pricePerKgUsd: 23,
    handlingFeeUsd: 28,
    minDays: 15,
    maxDays: 25,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "США, Израиль",
    destination: "США, Израиль",
    mode: "ems",
    pricePerKgUsd: 30,
    handlingFeeUsd: 35,
    minDays: 15,
    maxDays: 25,
    deliveryTarget: "до двери/отделения",
  },
  {
    title: "Остальные страны мира",
    destination: "Остальные страны мира (DHL/UPS/EMS/ARAMEX)",
    mode: "request",
    pricePerKgUsd: null,
    handlingFeeUsd: null,
    minDays: 10,
    maxDays: 25,
    deliveryTarget: "до двери/отделения",
    onRequest: true,
  },
];

export const ADDITIONAL_SERVICE_TARIFFS: AdditionalServiceTariff[] = [
  {
    title: "Компактная упаковка",
    description: "При необходимости или по желанию клиента.",
    pricingType: "per_kg",
    priceUsd: 0.5,
    unit: "$/кг",
  },
  {
    title: "Объединение (консолидация)",
    description: "Объединение нескольких посылок в одну общую посылку. Переупаковка обязательна.",
    pricingType: "per_kg",
    priceUsd: 0.3,
    unit: "$/кг",
  },
  {
    title: "Стандартная проверка на соответствие",
    description: "Проверка цвета, размера и видимых дефектов. Фото отправляются при обнаружении брака.",
    pricingType: "per_kg",
    priceUsd: 1,
    unit: "$/кг",
  },
  {
    title: "Детальная проверка и фотоотчет",
    description: "Тщательная проверка на соответствие и наличие брака с фотоотчетом.",
    pricingType: "per_lot",
    priceUsd: 2,
    unit: "$/лот",
  },
  {
    title: "Дополнительная страховка",
    description: "При необходимости или по желанию клиента.",
    pricingType: "percent_range",
    priceUsd: null,
    minPercent: 2,
    maxPercent: 10,
    unit: "% от стоимости товара",
  },
  {
    title: "Усиление упаковки",
    description: "При необходимости или по желанию клиента.",
    pricingType: "actual",
    priceUsd: null,
    unit: "по факту",
  },
];

export const ALL_SHIPPING_TARIFFS = [
  ...MAIN_SHIPPING_TARIFFS,
  ...EMS_SHIPPING_TARIFFS,
];

export function formatTariffPrice(tariff: ShippingTariff): string {
  if (tariff.onRequest) return "По запросу";
  return `${tariff.pricePerKgUsd}$/кг + ${tariff.handlingFeeUsd}$ оформление`;
}

export function formatTariffDays(tariff: ShippingTariff): string {
  if (tariff.minDays === null || tariff.maxDays === null) return "по запросу";
  return `${tariff.minDays}-${tariff.maxDays} дней`;
}

export function formatAdditionalServicePrice(service: AdditionalServiceTariff): string {
  if (service.pricingType === "percent_range") {
    return `${service.minPercent}-${service.maxPercent}%`;
  }
  if (service.pricingType === "actual") return "по факту";
  return `${service.priceUsd}${service.unit}`;
}
