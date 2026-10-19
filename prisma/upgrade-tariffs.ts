// Начальные данные тарифов PostmanFox: доставка и услуги. Запускается при деплое (npm run db:upgrade) и вручную:
//   npm run db:upgrade:tariffs
//
// Перенос «из кода в настройки», шаг 2 (docs/product/задание-настройки-вместо-кода.md). Цены — как были
// на сайте и в программе (lib/postmanfox-tariffs.ts до переноса), без изменений; дальше они правятся
// в «Логистика → Тарифы».
// Только один раз для компании: если у неё уже есть тарифы, скрипт их не трогает. Тарифы без компании,
// которые уже есть в базе, получают компанию и данные направления (совпадение — вид доставки, ставка и
// оформление); лишние становятся «не действует». Услуги без компании получают компанию и описание,
// недостающие создаются. Повторный запуск ничего не меняет.
import { PrismaClient, type PaymentTiming, type ServicePricingType } from "@prisma/client";

const prisma = new PrismaClient();

const COMPANY_CODE = "POSTMANFOX";
const TARIFFS_URL = "https://postmanfox.com/ru/tarify/";
const DOOR = "до двери/отделения";
const MAIN = "Основные направления";
const EMS = "EMS";

type ShippingSeed = {
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
  onRequest?: boolean;
};

const SHIPPING: ShippingSeed[] = [
  { section: MAIN, direction: "Россия (авто)", countryCodes: ["RU"], deliveryType: "TRUCK", pricePerKgUsd: 15, handlingFeeUsd: 5, minDays: 15, maxDays: 25, paymentTiming: "BEFORE" },
  { section: MAIN, direction: "Украина (авиа)", countryCodes: ["UA"], deliveryType: "AIR", pricePerKgUsd: 18, handlingFeeUsd: 2, minDays: 15, maxDays: 25, paymentTiming: "FLEXIBLE" },
  { section: MAIN, direction: "Украина (море)", countryCodes: ["UA"], deliveryType: "SEA", pricePerKgUsd: 7.5, handlingFeeUsd: 2, minDays: 50, maxDays: 65, paymentTiming: "FLEXIBLE" },
  { section: MAIN, direction: "Узбекистан (авиа)", cargoType: "простые товары", countryCodes: ["UZ"], deliveryType: "AIR", pricePerKgUsd: 13, handlingFeeUsd: 2, minDays: 10, maxDays: 15, paymentTiming: "FLEXIBLE" },
  { section: MAIN, direction: "Узбекистан (авиа)", cargoType: "порошки, жидкости, батарейки", countryCodes: ["UZ"], deliveryType: "AIR", pricePerKgUsd: 15, handlingFeeUsd: 2, minDays: 10, maxDays: 15, paymentTiming: "FLEXIBLE" },
  { section: MAIN, direction: "Казахстан (авто)", countryCodes: ["KZ"], deliveryType: "TRUCK", pricePerKgUsd: 7.5, handlingFeeUsd: 2, minDays: 15, maxDays: 18, paymentTiming: "BEFORE" },
  { section: MAIN, direction: "Беларусь (авто)", countryCodes: ["BY"], deliveryType: "TRUCK", pricePerKgUsd: 15, handlingFeeUsd: 3, minDays: 15, maxDays: 25, paymentTiming: "BEFORE" },
  { section: MAIN, direction: "Молдова (авто)", cargoType: "до 2 кг", countryCodes: ["MD"], deliveryType: "TRUCK", pricePerKgUsd: 20, handlingFeeUsd: 5, minDays: 15, maxDays: 25, paymentTiming: "FLEXIBLE" },
  { section: EMS, direction: "Южная Корея, Япония", countryCodes: ["KR", "JP"], deliveryType: "AIR", pricePerKgUsd: 11, handlingFeeUsd: 12, minDays: 10, maxDays: 18, paymentTiming: "BEFORE" },
  { section: EMS, direction: "Юго-Восточная Азия", countryCodes: ["TH", "PH", "ID", "VN", "KH", "MY", "SG"], deliveryType: "AIR", pricePerKgUsd: 12, handlingFeeUsd: 15, minDays: 10, maxDays: 18, paymentTiming: "BEFORE" },
  { section: EMS, direction: "Австралия, Новая Зеландия", countryCodes: ["AU", "NZ"], deliveryType: "AIR", pricePerKgUsd: 13, handlingFeeUsd: 20, minDays: 12, maxDays: 20, paymentTiming: "BEFORE" },
  {
    section: EMS,
    direction: "Европа и Грузия",
    countryCodes: ["DE", "FR", "IT", "ES", "AT", "BE", "GB", "DK", "FI", "GR", "IE", "LU", "PT", "SE", "PL", "CZ", "HU", "RO", "HR", "LV", "LT", "EE", "GE"],
    deliveryType: "AIR",
    pricePerKgUsd: 15,
    handlingFeeUsd: 25,
    minDays: 12,
    maxDays: 20,
    paymentTiming: "BEFORE",
  },
  {
    section: EMS,
    direction: "ОАЭ, Америка, Канада, Россия и др.",
    countryCodes: ["AE", "JO", "MA", "ZA", "AR", "BR", "CO", "PA", "PE", "CU", "MX", "CA", "CY", "MT", "NO", "CH", "RU"],
    deliveryType: "AIR",
    pricePerKgUsd: 20,
    handlingFeeUsd: 25,
    minDays: 15,
    maxDays: 25,
    paymentTiming: "BEFORE",
  },
  {
    section: EMS,
    direction: "Индия, Турция, Пакистан, Катар, Оман, Кения и др.",
    countryCodes: ["IN", "TR", "PK", "BD", "LK", "NP", "LA", "QA", "BH", "KW", "TN", "OM", "KE", "SN", "UG"],
    deliveryType: "AIR",
    pricePerKgUsd: 23,
    handlingFeeUsd: 28,
    minDays: 15,
    maxDays: 25,
    paymentTiming: "BEFORE",
  },
  { section: EMS, direction: "США, Израиль", countryCodes: ["US", "IL"], deliveryType: "AIR", pricePerKgUsd: 30, handlingFeeUsd: 35, minDays: 15, maxDays: 25, paymentTiming: "BEFORE" },
  { section: EMS, direction: "Остальные страны мира", cargoType: "DHL/UPS/EMS/ARAMEX", countryCodes: [], deliveryType: "AIR", pricePerKgUsd: 0, handlingFeeUsd: 0, minDays: 10, maxDays: 25, paymentTiming: "BEFORE", onRequest: true },
];

type ServiceSeed = {
  code: string;
  name: string;
  description: string | null;
  pricingType: ServicePricingType;
  value: number | null;
  percentMin?: number;
  percentMax?: number;
  selectableByClient?: boolean;
  inPriceList: boolean;
  sortOrder: number;
};

const SERVICES: ServiceSeed[] = [
  { code: "COMPACT_PACK", name: "Компактная упаковка", description: "При необходимости или по желанию клиента.", pricingType: "PER_KG", value: 0.5, inPriceList: true, sortOrder: 10 },
  { code: "CONSOLIDATION", name: "Консолидация", description: "Объединение нескольких посылок в одну общую посылку. Переупаковка обязательна.", pricingType: "PER_KG", value: 0.3, inPriceList: true, sortOrder: 20 },
  { code: "STANDARD_CHECK", name: "Стандартная проверка на соответствие", description: "Проверка цвета, размера и видимых дефектов. Фото отправляются при обнаружении брака.", pricingType: "PER_KG", value: 1, inPriceList: true, sortOrder: 30 },
  { code: "DETAILED_CHECK", name: "Детальная проверка и фотоотчёт", description: "Тщательная проверка на соответствие и наличие брака с фотоотчетом.", pricingType: "PER_ORDER", value: 2, selectableByClient: true, inPriceList: true, sortOrder: 40 },
  { code: "KEEP_ORIGINAL_PACK", name: "Оставить оригинальную упаковку", description: null, pricingType: "PER_ORDER", value: 0, selectableByClient: true, inPriceList: false, sortOrder: 45 },
  { code: "INSURANCE", name: "Дополнительная страховка", description: "При необходимости или по желанию клиента.", pricingType: "PERCENT", value: null, percentMin: 2, percentMax: 10, inPriceList: true, sortOrder: 50 },
  { code: "REINFORCED_PACK", name: "Усиленная упаковка", description: "При необходимости или по желанию клиента.", pricingType: "MANUAL", value: null, inPriceList: true, sortOrder: 60 },
  { code: "LOCAL_DELIVERY", name: "Доставка до склада", description: null, pricingType: "MANUAL", value: null, inPriceList: false, sortOrder: 70 },
];

async function migrateShipping(companyId: string) {
  if (await prisma.shippingTariff.count({ where: { companyId } })) return;

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
    const { onRequest = false, cargoType = null, ...rest } = seed;
    const data = { ...rest, companyId, cargoType, onRequest, deliveryTarget: DOOR, sortOrder: (index + 1) * 10, active: true };
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

async function migrateServices(companyId: string) {
  let migrated = 0;
  let created = 0;
  for (const { percentMin = null, percentMax = null, selectableByClient = false, ...seed } of SERVICES) {
    const existing = await prisma.serviceTariff.findUnique({ where: { code: seed.code } });
    if (existing?.companyId) continue;
    if (existing) {
      await prisma.serviceTariff.update({
        where: { code: seed.code },
        data: { companyId, description: existing.description ?? seed.description, inPriceList: seed.inPriceList, sortOrder: seed.sortOrder },
      });
      migrated += 1;
    } else {
      await prisma.serviceTariff.create({ data: { ...seed, companyId, percentMin, percentMax, selectableByClient } });
      created += 1;
    }
  }
  if (migrated || created) console.log(`Услуги: перенесено ${migrated}, создано ${created}`);
}

async function main() {
  const company = await prisma.company.findUnique({ where: { code: COMPANY_CODE }, select: { id: true, tariffsUrl: true } });
  if (!company) {
    console.warn(`Нет компании ${COMPANY_CODE} — тарифы не перенесены (сначала npm run db:upgrade:companies)`);
    return;
  }
  const firstRun = (await prisma.shippingTariff.count({ where: { companyId: company.id } })) === 0;
  if (firstRun && !company.tariffsUrl) {
    await prisma.company.update({ where: { id: company.id }, data: { tariffsUrl: TARIFFS_URL } });
  }
  await migrateShipping(company.id);
  await migrateServices(company.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
