// Начальные данные тарифов PostmanFox: доставка и услуги. Запускается при деплое (npm run db:upgrade) и вручную:
//   npm run db:upgrade:tariffs
//
// Перенос «из кода в настройки», шаг 2 (docs/product/задание-настройки-вместо-кода.md). Цены — по прайс-листу
// владельца «Тарифы и сроки доставки посылок» (прислан 2026-10-20); раздел «Карго доставка» — позже.
// Дальше тарифы правятся в «Логистика → Тарифы».
//
// Первый запуск для компании (тарифов у неё ещё нет): тарифы без компании, которые уже есть в базе, получают
// компанию и данные направления (совпадение — вид доставки, ставка и оформление), лишние становятся
// «не действует»; недостающие создаются. Услуги без компании получают компанию и описание, недостающие создаются.
// Если тарифы уже перенесены по первому, устаревшему списку (2026-10-19, из lib/postmanfox-tariffs.ts),
// их строки исправляются по прайс-листу; строку, которую уже поменяли в админке, скрипт не трогает.
// Повторный запуск ничего не меняет.
import { PrismaClient, type PaymentTiming, type ServicePricingType } from "@prisma/client";

const prisma = new PrismaClient();

const COMPANY_CODE = "POSTMANFOX";
const TARIFFS_URL = "https://postmanfox.com/ru/tarify/";
const DOOR = "до двери/отделения";
const MAIN = "Основные страны";
const POST = "Почтовая авиа доставка (DHL/UPS/EMS/ARAMEX)";

type ShippingSeed = {
  key: string;
  section: string;
  direction: string;
  countryCodes: string[];
  deliveryType: "AIR" | "SEA" | "TRUCK";
  pricePerKgUsd: number;
  handlingFeeUsd: number;
  minDays: number;
  maxDays: number;
  paymentTiming: PaymentTiming;
  cargoType?: string;
};

const SHIPPING: ShippingSeed[] = [
  { key: "RU", section: MAIN, direction: "Россия (авто)", countryCodes: ["RU"], deliveryType: "TRUCK", pricePerKgUsd: 15, handlingFeeUsd: 5, minDays: 15, maxDays: 25, paymentTiming: "BEFORE" },
  { key: "UA_AIR", section: MAIN, direction: "Украина (авиа)", countryCodes: ["UA"], deliveryType: "AIR", pricePerKgUsd: 18, handlingFeeUsd: 2, minDays: 15, maxDays: 18, paymentTiming: "FLEXIBLE" },
  { key: "UA_SEA", section: MAIN, direction: "Украина (море)", countryCodes: ["UA"], deliveryType: "SEA", pricePerKgUsd: 7.5, handlingFeeUsd: 2, minDays: 50, maxDays: 65, paymentTiming: "FLEXIBLE" },
  { key: "BY", section: MAIN, direction: "Беларусь (авто)", countryCodes: ["BY"], deliveryType: "TRUCK", pricePerKgUsd: 15, handlingFeeUsd: 3, minDays: 15, maxDays: 25, paymentTiming: "BEFORE" },
  { key: "MD", section: MAIN, direction: "Молдова", cargoType: "до 5 кг", countryCodes: ["MD"], deliveryType: "TRUCK", pricePerKgUsd: 18, handlingFeeUsd: 10, minDays: 15, maxDays: 20, paymentTiming: "FLEXIBLE" },
  { key: "KR_JP", section: POST, direction: "Южная Корея, Япония", countryCodes: ["KR", "JP"], deliveryType: "AIR", pricePerKgUsd: 11, handlingFeeUsd: 12, minDays: 10, maxDays: 15, paymentTiming: "BEFORE" },
  {
    key: "ASIA_OCEANIA",
    section: POST,
    direction: "Юго-Восточная Азия, Австралия, Новая Зеландия",
    countryCodes: ["TH", "PH", "ID", "VN", "KH", "MY", "SG", "AU", "NZ"],
    deliveryType: "AIR",
    pricePerKgUsd: 13,
    handlingFeeUsd: 20,
    minDays: 12,
    maxDays: 18,
    paymentTiming: "BEFORE",
  },
  {
    key: "EU",
    section: POST,
    direction: "Европа и Грузия",
    countryCodes: ["DE", "FR", "IT", "ES", "AT", "BE", "GB", "DK", "FI", "GR", "IE", "LU", "PT", "SE", "PL", "CZ", "HU", "RO", "HR", "LV", "LT", "EE", "GE"],
    deliveryType: "AIR",
    pricePerKgUsd: 15,
    handlingFeeUsd: 25,
    minDays: 12,
    maxDays: 18,
    paymentTiming: "BEFORE",
  },
  {
    key: "AMERICAS",
    section: POST,
    direction: "ОАЭ, Америка, Канада, Россия и др.",
    countryCodes: ["AE", "JO", "MA", "ZA", "AR", "BR", "CO", "PA", "PE", "CU", "MX", "CA", "CY", "MT", "NO", "CH", "RU"],
    deliveryType: "AIR",
    pricePerKgUsd: 20,
    handlingFeeUsd: 25,
    minDays: 12,
    maxDays: 18,
    paymentTiming: "BEFORE",
  },
  {
    key: "INDIA",
    section: POST,
    direction: "Индия, Пакистан, Катар, Оман, Кения и др.",
    countryCodes: ["IN", "PK", "BD", "LK", "NP", "LA", "QA", "BH", "KW", "TN", "OM", "KE", "SN", "UG"],
    deliveryType: "AIR",
    pricePerKgUsd: 23,
    handlingFeeUsd: 28,
    minDays: 15,
    maxDays: 20,
    paymentTiming: "BEFORE",
  },
  { key: "US_IL", section: POST, direction: "США, Израиль", countryCodes: ["US", "IL"], deliveryType: "AIR", pricePerKgUsd: 30, handlingFeeUsd: 35, minDays: 12, maxDays: 18, paymentTiming: "BEFORE" },
];

// Строки первого переноса (2026-10-19, устаревший список) и чем они становятся по прайс-листу; to — ключ тарифа,
// null — направления в прайс-листе нет, строка становится «не действует».
const FIRST_LIST: { section: string; direction: string; cargoType: string | null; deliveryType: string; price: number; fee: number; to: string | null }[] = [
  { section: "Основные направления", direction: "Россия (авто)", cargoType: null, deliveryType: "TRUCK", price: 15, fee: 5, to: "RU" },
  { section: "Основные направления", direction: "Украина (авиа)", cargoType: null, deliveryType: "AIR", price: 18, fee: 2, to: "UA_AIR" },
  { section: "Основные направления", direction: "Украина (море)", cargoType: null, deliveryType: "SEA", price: 7.5, fee: 2, to: "UA_SEA" },
  { section: "Основные направления", direction: "Узбекистан (авиа)", cargoType: "простые товары", deliveryType: "AIR", price: 13, fee: 2, to: null },
  { section: "Основные направления", direction: "Узбекистан (авиа)", cargoType: "порошки, жидкости, батарейки", deliveryType: "AIR", price: 15, fee: 2, to: null },
  { section: "Основные направления", direction: "Казахстан (авто)", cargoType: null, deliveryType: "TRUCK", price: 7.5, fee: 2, to: null },
  { section: "Основные направления", direction: "Беларусь (авто)", cargoType: null, deliveryType: "TRUCK", price: 15, fee: 3, to: "BY" },
  { section: "Основные направления", direction: "Молдова (авто)", cargoType: "до 2 кг", deliveryType: "TRUCK", price: 20, fee: 5, to: "MD" },
  { section: "EMS", direction: "Южная Корея, Япония", cargoType: null, deliveryType: "AIR", price: 11, fee: 12, to: "KR_JP" },
  { section: "EMS", direction: "Юго-Восточная Азия", cargoType: null, deliveryType: "AIR", price: 12, fee: 15, to: null },
  { section: "EMS", direction: "Австралия, Новая Зеландия", cargoType: null, deliveryType: "AIR", price: 13, fee: 20, to: "ASIA_OCEANIA" },
  { section: "EMS", direction: "Европа и Грузия", cargoType: null, deliveryType: "AIR", price: 15, fee: 25, to: "EU" },
  { section: "EMS", direction: "ОАЭ, Америка, Канада, Россия и др.", cargoType: null, deliveryType: "AIR", price: 20, fee: 25, to: "AMERICAS" },
  { section: "EMS", direction: "Индия, Турция, Пакистан, Катар, Оман, Кения и др.", cargoType: null, deliveryType: "AIR", price: 23, fee: 28, to: "INDIA" },
  { section: "EMS", direction: "США, Израиль", cargoType: null, deliveryType: "AIR", price: 30, fee: 35, to: "US_IL" },
  { section: "EMS", direction: "Остальные страны мира", cargoType: "DHL/UPS/EMS/ARAMEX", deliveryType: "AIR", price: 0, fee: 0, to: null },
];

type ServiceSeed = {
  code: string;
  name: string;
  description: string | null;
  firstListDescription?: string; // описание из первого переноса — по нему видно, что услугу в админке ещё не меняли
  pricingType: ServicePricingType;
  value: number | null;
  percentMin?: number;
  percentMax?: number;
  selectableByClient?: boolean;
  inPriceList: boolean;
  sortOrder: number;
};

const AS_NEEDED = "При необходимости (без уведомления клиента) или по желанию клиента.";
const AS_NEEDED_V1 = "При необходимости или по желанию клиента.";

const SERVICES: ServiceSeed[] = [
  { code: "COMPACT_PACK", name: "Компактная упаковка", description: AS_NEEDED, firstListDescription: AS_NEEDED_V1, pricingType: "PER_KG", value: 0.5, inPriceList: true, sortOrder: 10 },
  {
    code: "CONSOLIDATION",
    name: "Консолидация",
    description: "Объединение (консолидация) нескольких посылок в одну общую посылку (переупаковка обязательна).",
    firstListDescription: "Объединение нескольких посылок в одну общую посылку. Переупаковка обязательна.",
    pricingType: "PER_KG",
    value: 0.3,
    inPriceList: true,
    sortOrder: 20,
  },
  {
    code: "DETAILED_CHECK",
    name: "Детальная проверка и фотоотчёт",
    description: "Товар тщательно проверяется на соответствие и на наличие брака и фотографируется. После фотографии отправляются клиенту.",
    firstListDescription: "Тщательная проверка на соответствие и наличие брака с фотоотчетом.",
    pricingType: "PER_ORDER",
    value: 2,
    selectableByClient: true,
    inPriceList: true,
    sortOrder: 30,
  },
  { code: "KEEP_ORIGINAL_PACK", name: "Оставить оригинальную упаковку", description: null, pricingType: "PER_ORDER", value: 0, selectableByClient: true, inPriceList: false, sortOrder: 35 },
  { code: "INSURANCE", name: "Дополнительная страховка", description: AS_NEEDED, firstListDescription: AS_NEEDED_V1, pricingType: "PERCENT", value: null, percentMin: 2, percentMax: 10, inPriceList: true, sortOrder: 40 },
  { code: "REINFORCED_PACK", name: "Усиленная упаковка", description: AS_NEEDED, firstListDescription: AS_NEEDED_V1, pricingType: "MANUAL", value: null, inPriceList: true, sortOrder: 50 },
  { code: "MARKETPLACE_PURCHASE", name: "Выкуп из маркетплейсов", description: "TaoBao, 1688, Poizon, WeChat и т.д. (проекты по запросу).", pricingType: "PERCENT", value: null, percentMin: 5, percentMax: 10, inPriceList: true, sortOrder: 60 },
  {
    code: "STANDARD_CHECK",
    name: "Стандартная проверка на соответствие",
    description: "При выкупе товара: проверка на соответствие цвета, размера и видимых дефектов. Фотографии товара отправляются только в случае обнаружения брака.",
    firstListDescription: "Проверка цвета, размера и видимых дефектов. Фото отправляются при обнаружении брака.",
    pricingType: "PER_KG",
    value: 1,
    inPriceList: true,
    sortOrder: 70,
  },
  { code: "FULFILLMENT", name: "Фулфилмент", description: "Хранение на складе с целью дальнейшей отправки в иную транспортную службу. Максимальный срок хранения — два месяца.", pricingType: "PER_KG", value: 3, inPriceList: true, sortOrder: 80 },
  { code: "FOX2DOOR", name: "Fox2Door (закупка под ключ)", description: "Клиент выбирает товар, оплачивает указанную сумму, далее получает у двери.", pricingType: "REQUEST", value: null, inPriceList: true, sortOrder: 90 },
  { code: "LOCAL_DELIVERY", name: "Доставка до склада", description: null, pricingType: "MANUAL", value: null, inPriceList: false, sortOrder: 100 },
];

const shippingData = ({ key, cargoType, ...rest }: ShippingSeed, companyId: string, index: number) => {
  void key;
  return { ...rest, companyId, cargoType: cargoType ?? null, onRequest: false, deliveryTarget: DOOR, sortOrder: (index + 1) * 10 };
};

/** Первый перенос: тарифов у компании ещё нет. */
async function migrateShipping(companyId: string) {
  const methods = await prisma.deliveryMethod.findMany({ select: { code: true } });
  const missing = [...new Set(SHIPPING.map((seed) => seed.deliveryType))].filter((code) => !methods.some((m) => m.code === code));
  if (missing.length) {
    console.warn(`Нет видов доставки ${missing.join(", ")} — тарифы доставки не перенесены; заполните «Виды доставки» и запустите снова.`);
    return;
  }

  const unowned = await prisma.shippingTariff.findMany({ where: { companyId: null }, orderBy: { createdAt: "asc" } });
  const used = new Set<string>();
  let updated = 0;
  let created = 0;

  for (const [index, seed] of SHIPPING.entries()) {
    const data = { ...shippingData(seed, companyId, index), active: true };
    const match = unowned.find(
      (row) =>
        !used.has(row.id) &&
        row.deliveryType === seed.deliveryType &&
        Number(row.pricePerKgUsd) === seed.pricePerKgUsd &&
        Number(row.handlingFeeUsd) === seed.handlingFeeUsd,
    );
    if (match) {
      used.add(match.id);
      await prisma.shippingTariff.update({ where: { id: match.id }, data });
      updated += 1;
    } else {
      await prisma.shippingTariff.create({ data });
      created += 1;
    }
  }

  const leftover = unowned.filter((row) => !used.has(row.id)).map((row) => row.id);
  if (leftover.length) {
    await prisma.shippingTariff.updateMany({ where: { id: { in: leftover } }, data: { companyId, active: false } });
  }
  console.log(`Тарифы доставки: обновлено ${updated}, создано ${created}, не действует ${leftover.length}`);
}

/** Тарифы, перенесённые по первому, устаревшему списку, — по прайс-листу. Изменённые в админке строки не трогаются. */
async function correctFirstList(companyId: string) {
  const rows = await prisma.shippingTariff.findMany({ where: { companyId } });
  let corrected = 0;
  let deactivated = 0;
  for (const old of FIRST_LIST) {
    const row = rows.find(
      (item) =>
        item.section === old.section &&
        item.direction === old.direction &&
        item.cargoType === old.cargoType &&
        item.deliveryType === old.deliveryType &&
        Number(item.pricePerKgUsd) === old.price &&
        Number(item.handlingFeeUsd) === old.fee,
    );
    if (!row) continue;
    const index = SHIPPING.findIndex((seed) => seed.key === old.to);
    if (index < 0) {
      if (row.active) {
        await prisma.shippingTariff.update({ where: { id: row.id }, data: { active: false } });
        deactivated += 1;
      }
      continue;
    }
    // «Действует» остаётся как есть: отметку могли поменять в админке.
    await prisma.shippingTariff.update({ where: { id: row.id }, data: shippingData(SHIPPING[index], companyId, index) });
    corrected += 1;
  }
  if (corrected || deactivated) console.log(`Тарифы по прайс-листу: исправлено ${corrected}, не действует ${deactivated}`);
}

async function migrateServices(companyId: string) {
  let migrated = 0;
  let corrected = 0;
  let created = 0;
  for (const { percentMin = null, percentMax = null, selectableByClient = false, firstListDescription, ...seed } of SERVICES) {
    const existing = await prisma.serviceTariff.findUnique({ where: { code: seed.code } });
    if (!existing) {
      await prisma.serviceTariff.create({ data: { ...seed, companyId, percentMin, percentMax, selectableByClient } });
      created += 1;
    } else if (!existing.companyId) {
      await prisma.serviceTariff.update({
        where: { code: seed.code },
        data: { companyId, description: existing.description ?? seed.description, inPriceList: seed.inPriceList, sortOrder: seed.sortOrder },
      });
      migrated += 1;
    } else if (firstListDescription && existing.description === firstListDescription) {
      // Описание из первого переноса — услугу в админке не меняли: описание и порядок — по прайс-листу.
      await prisma.serviceTariff.update({ where: { code: seed.code }, data: { description: seed.description, sortOrder: seed.sortOrder } });
      corrected += 1;
    }
  }
  if (migrated || corrected || created) console.log(`Услуги: перенесено ${migrated}, исправлено по прайс-листу ${corrected}, создано ${created}`);
}

async function main() {
  const company = await prisma.company.findUnique({ where: { code: COMPANY_CODE }, select: { id: true, tariffsUrl: true } });
  if (!company) {
    console.warn(`Нет компании ${COMPANY_CODE} — тарифы не перенесены (сначала npm run db:upgrade:companies)`);
    return;
  }
  const firstRun = (await prisma.shippingTariff.count({ where: { companyId: company.id } })) === 0;
  if (firstRun) {
    if (!company.tariffsUrl) await prisma.company.update({ where: { id: company.id }, data: { tariffsUrl: TARIFFS_URL } });
    await migrateShipping(company.id);
  } else {
    await correctFirstList(company.id);
  }
  await migrateServices(company.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
