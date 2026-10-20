// Регистр курсов: начальная запись — курсы на момент запуска журнала. Запускается при деплое (npm run db:upgrade)
// и вручную: npm run db:upgrade:rates
//
// Дальше записи появляются сами при каждом изменении курса в «Финансы → Курс». Кто и когда поставил нынешний
// курс, берётся из настроек (последнее сохранение). Только если журнал пуст; повторный запуск ничего не меняет.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (await prisma.exchangeRateChange.count()) return;
  const settings = await prisma.financeSettings.findFirst();
  if (!settings) return;

  const author = settings.updatedBy
    ? await prisma.user.findUnique({ where: { id: settings.updatedBy }, select: { id: true } })
    : null;
  const rates = [
    { currency: "USD" as const, newRate: settings.exchangeRateCnyPerUsd },
    { currency: "EUR" as const, newRate: settings.exchangeRateCnyPerEur },
  ].filter((rate) => rate.newRate != null);
  if (!rates.length) return;

  await prisma.exchangeRateChange.createMany({
    data: rates.map((rate) => ({
      ...rate,
      oldRate: null,
      note: "курс на момент запуска журнала",
      changedAt: settings.updatedAt,
      changedById: author?.id ?? null,
    })),
  });
  console.log(`Регистр курсов: начальная запись (${rates.map((rate) => `${rate.currency} ${rate.newRate}`).join(", ")})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
