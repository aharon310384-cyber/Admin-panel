// Seed справочников для схемы v2 (dev.db): тарифы доставки, услуги, курс, тест-админ.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const SHIPPING = [
  // direction, deliveryType, pricePerKgUsd, handlingFeeUsd, minDays, maxDays, paymentTiming
  ["Россия", "AUTO", 15, 5, 15, 25, "BEFORE"],
  ["Украина", "AIR", 18, 2, 15, 25, "FLEXIBLE"],
  ["Украина", "SEA", 7.5, 2, 50, 65, "FLEXIBLE"],
  ["Узбекистан (простые товары)", "AIR", 13, 2, 10, 15, "FLEXIBLE"],
  ["Узбекистан (порошки/жидкости/батарейки)", "AIR", 15, 2, 10, 15, "FLEXIBLE"],
  ["Казахстан", "AUTO", 7.5, 2, 15, 18, "BEFORE"],
  ["Беларусь", "AUTO", 15, 3, 15, 25, "BEFORE"],
  ["Молдова (до 2 кг)", "AUTO", 20, 5, 15, 25, "FLEXIBLE"],
  // EMS — оплата до отправки
  ["Южная Корея, Япония", "EMS", 11, 12, 10, 18, "BEFORE"],
  ["Юго-Восточная Азия", "EMS", 12, 15, 10, 18, "BEFORE"],
  ["Австралия, Новая Зеландия", "EMS", 13, 20, 12, 20, "BEFORE"],
  ["Европа и Грузия", "EMS", 15, 25, 12, 20, "BEFORE"],
  ["ОАЭ, Америка, Канада, Россия и др.", "EMS", 20, 25, 15, 25, "BEFORE"],
  ["Индия, Турция, Пакистан и др.", "EMS", 23, 28, 15, 25, "BEFORE"],
  ["США, Израиль", "EMS", 30, 35, 15, 25, "BEFORE"],
];

const SERVICES = [
  // code, name, pricingType, value, percentMin, percentMax, selectableByClient, sortOrder
  ["CONSOLIDATION", "Консолидация", "PER_KG", 0.3, null, null, false, 10],
  ["COMPACT_PACK", "Компактная упаковка", "PER_KG", 0.5, null, null, false, 20],
  ["REINFORCED_PACK", "Усиленная упаковка", "MANUAL", null, null, null, false, 30],
  ["STANDARD_CHECK", "Стандартная проверка на соответствие", "PER_KG", 1.0, null, null, false, 40],
  ["DETAILED_CHECK", "Детальная проверка и фотоотчёт", "PER_ORDER", 2.0, null, null, true, 50],
  ["INSURANCE", "Дополнительная страховка", "PERCENT", null, 2, 10, false, 60],
  ["LOCAL_DELIVERY", "Доставка до склада", "MANUAL", null, null, null, false, 70],
];

(async () => {
  for (const [direction, deliveryType, price, fee, minD, maxD, timing] of SHIPPING) {
    await prisma.shippingTariff.create({
      data: {
        direction, deliveryType, pricePerKgUsd: price, handlingFeeUsd: fee,
        minDays: minD, maxDays: maxD, paymentTiming: timing,
      },
    });
  }
  for (const [code, name, pricingType, value, pMin, pMax, selectable, sort] of SERVICES) {
    await prisma.serviceTariff.create({
      data: {
        code, name, pricingType, value, percentMin: pMin, percentMax: pMax,
        selectableByClient: selectable, sortOrder: sort,
      },
    });
  }
  await prisma.financeSettings.create({ data: { exchangeRateCnyPerUsd: 7.1 } });
  await prisma.user.create({
    data: {
      email: "admin@postmanfox.dev",
      password: await bcrypt.hash("admin123", 10),
      name: "Dev Admin",
      role: "ADMIN",
    },
  });

  const counts = {
    shipping: await prisma.shippingTariff.count(),
    services: await prisma.serviceTariff.count(),
    users: await prisma.user.count(),
  };
  console.log("SEED OK:", JSON.stringify(counts));
  await prisma.$disconnect();
})().catch((e) => { console.error("SEED ERR:", e.message); process.exit(1); });
