// Страны и города клиентов и получателей — по-английски (решение владельца 2026-10-27).
// Страна → английское название из справочника (у получателя — и код страны); город кириллицей → английское название
// с карты OpenStreetMap, а не нашёлся — по буквам (lib/geo-names.ts). Нет страны в справочнике — не трогаем.
// Запускается при деплое (npm run db:upgrade) и вручную: npm run db:upgrade:geo-english. Повторный запуск ничего не меняет.
// Карту спрашиваем не чаще раза в секунду, поэтому за один запуск — не дольше TIME_BUDGET: остальные города переведутся
// при следующем запуске. В журнал — только количество, без имён и адресов (журнал выкладки открыт).
import { PrismaClient } from "@prisma/client";
import { englishCity, hasCyrillic, matchCountry, type EnglishCity } from "../lib/geo-names";

const prisma = new PrismaClient();
const TIME_BUDGET = Number(process.env.GEO_TIME_BUDGET_MS ?? 120_000);

async function main() {
  const started = Date.now();
  const countries = await prisma.country.findMany({ select: { code: true, nameRu: true, nameEn: true, aliases: true } });
  const byCode = new Map(countries.map((c) => [c.code, c]));
  const counts = { customers: 0, recipients: 0, unknown: 0, cityMap: 0, cityLetters: 0, cityLeft: 0 };

  const translate = async (city: string | null, code: string | null | undefined): Promise<EnglishCity | null> => {
    if (!city || !hasCyrillic(city)) return null;
    if (Date.now() - started > TIME_BUDGET) {
      counts.cityLeft++;
      return null;
    }
    const result = await englishCity(city, code);
    if (result.source === "offline") {
      // карта не ответила — по буквам не переводим, попробуем при следующей выкладке
      counts.cityLeft++;
      return null;
    }
    if (result.source === "map") counts.cityMap++;
    else counts.cityLetters++;
    return result;
  };

  const customers = await prisma.customer.findMany({ select: { id: true, country: true, city: true } });
  for (const c of customers) {
    const country = matchCountry(c.country, countries);
    if (c.country && !country) counts.unknown++;
    const city = await translate(c.city, country?.code);
    const data = {
      ...(country && country.nameEn !== c.country ? { country: country.nameEn } : {}),
      ...(city ? { city: city.name } : {}),
    };
    if (!Object.keys(data).length) continue;
    await prisma.customer.update({ where: { id: c.id }, data });
    counts.customers++;
  }

  const recipients = await prisma.recipient.findMany({ select: { id: true, countryCode: true, country: true, city: true } });
  for (const r of recipients) {
    const country = (r.countryCode && byCode.get(r.countryCode.toUpperCase())) || matchCountry(r.country, countries);
    if (r.country && !country) counts.unknown++;
    const city = await translate(r.city, country?.code);
    const data = {
      ...(country && (country.nameEn !== r.country || country.code !== r.countryCode) ? { country: country.nameEn, countryCode: country.code } : {}),
      ...(city ? { city: city.name } : {}),
    };
    if (!Object.keys(data).length) continue;
    await prisma.recipient.update({ where: { id: r.id }, data });
    counts.recipients++;
  }

  console.log(
    `Страны и города по-английски: изменено клиентов ${counts.customers}, получателей ${counts.recipients}; ` +
      `стран нет в справочнике ${counts.unknown}; городов с карты ${counts.cityMap}, по буквам ${counts.cityLetters}` +
      (counts.cityLeft ? `, осталось ${counts.cityLeft} — переведутся при следующей выкладке` : ""),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
