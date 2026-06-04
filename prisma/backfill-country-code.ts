import { prisma } from "../lib/prisma";

const MAP: Record<string, string> = {
  // English names
  "usa": "US",
  "us": "US",
  "united states": "US",
  "united states of america": "US",
  "ukraine": "UA",
  "germany": "DE",
  "russia": "RU",
  "russian federation": "RU",
  "united arab emirates": "AE",
  "uae": "AE",
  "italy": "IT",
  "spain": "ES",
  "poland": "PL",
  "uzbekistan": "UZ",
  "france": "FR",
  "united kingdom": "GB",
  "uk": "GB",
  "great britain": "GB",
  "switzerland": "CH",
  "cyprus": "CY",
  "moldova": "MD",
  "latvia": "LV",
  "australia": "AU",
  "canada": "CA",
  "austria": "AT",
  "czechia": "CZ",
  "czech republic": "CZ",
  "denmark": "DK",
  "lithuania": "LT",
  "mexico": "MX",
  "slovenia": "SI",
  "greece": "GR",
  "sweden": "SE",
  "bulgaria": "BG",
  "china": "CN",
  "georgia": "GE",
  "hungary": "HU",
  "malta": "MT",
  "belarus": "BY",
  "belgium": "BE",
  "monaco": "MC",
  "netherlands": "NL",
  "portugal": "PT",
  "turkey": "TR",
  "indonesia": "ID",
  "japan": "JP",
  "luxembourg": "LU",
  "norway": "NO",
  "romania": "RO",
  "saudi arabia": "SA",
  "mongolia": "MN",
  "montenegro": "ME",
  "serbia": "RS",
  "singapore": "SG",

  // Russian names
  "сша": "US",
  "украина": "UA",
  "германия": "DE",
  "россия": "RU",
  "оаэ": "AE",
  "объединённые арабские эмираты": "AE",
  "объединенные арабские эмираты": "AE",
  "италия": "IT",
  "испания": "ES",
  "польша": "PL",
  "узбекистан": "UZ",
  "франция": "FR",
  "великобритания": "GB",
  "англия": "GB",
  "швейцария": "CH",
  "кипр": "CY",
  "молдова": "MD",
  "молдавия": "MD",
  "латвия": "LV",
  "австралия": "AU",
  "канада": "CA",
  "австрия": "AT",
  "чехия": "CZ",
  "дания": "DK",
  "литва": "LT",
  "мексика": "MX",
  "словения": "SI",
  "греция": "GR",
  "швеция": "SE",
  "болгария": "BG",
  "китай": "CN",
  "грузия": "GE",
  "венгрия": "HU",
  "мальта": "MT",
  "беларусь": "BY",
  "белоруссия": "BY",
  "бельгия": "BE",
  "монако": "MC",
  "нидерланды": "NL",
  "голландия": "NL",
  "португалия": "PT",
  "турция": "TR",
  "индонезия": "ID",
  "япония": "JP",
  "люксембург": "LU",
  "норвегия": "NO",
  "румыния": "RO",
  "саудовская аравия": "SA",
  "монголия": "MN",
  "черногория": "ME",
  "сербия": "RS",
  "сингапур": "SG",
};

function resolveCode(country: string): string | null {
  const trimmed = country.trim();
  if (!trimmed) return null;

  // Already a 2-letter Latin code → keep as is (NY, VT, IS, ET, TL, DM, SB, AT, DE, GE, IR, KZ, MC, CN, US)
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const key = trimmed.toLowerCase();
  return MAP[key] ?? null;
}

async function main() {
  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      country: { not: null },
    },
    select: { id: true, country: true, countryCode: true },
  });

  let updated = 0;
  let skipped = 0;
  const unknown = new Map<string, number>();

  for (const c of customers) {
    if (!c.country) continue;
    const code = resolveCode(c.country);

    if (!code) {
      unknown.set(c.country, (unknown.get(c.country) ?? 0) + 1);
      continue;
    }

    if (c.countryCode === code) {
      skipped++;
      continue;
    }

    await prisma.customer.update({
      where: { id: c.id },
      data: { countryCode: code },
    });
    updated++;
  }

  console.log(`Обновлено: ${updated}`);
  console.log(`Пропущено (уже корректно): ${skipped}`);

  if (unknown.size > 0) {
    console.log("\nНе удалось распознать (значение → шт):");
    for (const [name, n] of [...unknown.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)}  ${JSON.stringify(name)}`);
    }
  }

  await prisma.$disconnect();
}

main();
