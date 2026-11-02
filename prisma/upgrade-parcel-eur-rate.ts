// Курс ¥ за € у посылок с пошлиной ЕС (владелец 2026-10-29): раньше его в посылке не было, карточка брала курс из
// «Финансы» и у посылок из Excel писала «пошлина изменилась». Курс восстанавливаем из выставленной пошлины:
// € × (¥/€ ÷ ¥/$) = $ → ¥/€ = $ × ¥/$ ÷ €. Берём первый курс, с которым выходит та же пошлина в $: из «Финансы»
// (им считались посылки, оформленные вручную), круглый до копеек, точный.
// Посылки, где курс уже есть или пошлины нет, не трогает. Запускается при деплое (npm run db:upgrade)
// и вручную: npm run db:upgrade:parcel-eur-rate.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

async function main() {
  const finance = await prisma.financeSettings.findFirst({ select: { exchangeRateCnyPerEur: true } });
  const financeEur = finance?.exchangeRateCnyPerEur != null ? Number(finance.exchangeRateCnyPerEur) : null;
  const parcels = await prisma.parcel.findMany({
    where: { exchangeRateCnyPerEur: null, customsDutyEur: { gt: 0 }, customsDutyUsd: { gt: 0 } },
    select: { id: true, exchangeRateCnyPerUsd: true, customsDutyEur: true, customsDutyUsd: true },
  });
  let set = 0;
  for (const p of parcels) {
    const usdRate = Number(p.exchangeRateCnyPerUsd);
    const eur = Number(p.customsDutyEur);
    const usd = round(Number(p.customsDutyUsd), 2);
    if (!(usdRate > 0)) continue;
    const exact = (usd * usdRate) / eur;
    const candidates = [financeEur, round(exact, 2)].filter((r): r is number => r != null && r > 0);
    const rate = candidates.find((r) => round((eur * r) / usdRate, 2) === usd) ?? round(exact, 6);
    await prisma.parcel.update({ where: { id: p.id }, data: { exchangeRateCnyPerEur: rate } });
    set += 1;
  }
  if (set) console.log(`Курс ¥ за € у посылок с пошлиной ЕС: проставлено ${set}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
