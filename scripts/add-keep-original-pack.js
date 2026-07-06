// Добавляет услугу «Оставить оригинальную упаковку» (бесплатно, за позицию) в справочник ServiceTariff.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const detailed = await prisma.serviceTariff.findUnique({ where: { code: "DETAILED_CHECK" } });
  const sortOrder = (detailed ? detailed.sortOrder : 0) + 1;
  const row = await prisma.serviceTariff.upsert({
    where: { code: "KEEP_ORIGINAL_PACK" },
    update: { name: "Оставить оригинальную упаковку", pricingType: "PER_ORDER", value: 0, selectableByClient: true, active: true },
    create: {
      code: "KEEP_ORIGINAL_PACK",
      name: "Оставить оригинальную упаковку",
      pricingType: "PER_ORDER",
      value: 0,
      selectableByClient: true,
      active: true,
      sortOrder,
    },
  });
  console.log("upsert ok:", JSON.stringify({ code: row.code, name: row.name, type: row.pricingType, value: row.value, sortOrder: row.sortOrder }));
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
