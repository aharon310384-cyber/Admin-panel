import { prisma } from "../lib/prisma";

type CountrySeed = {
  code: string;
  nameRu: string;
  nameEn: string;
  postalCodeRegex: string | null;
  postalCodeExample: string | null;
};

const COUNTRIES: CountrySeed[] = [
  { code: "AE", nameRu: "ОАЭ", nameEn: "United Arab Emirates", postalCodeRegex: null, postalCodeExample: null },
  { code: "AT", nameRu: "Австрия", nameEn: "Austria", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1010" },
  { code: "AU", nameRu: "Австралия", nameEn: "Australia", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "2000" },
  { code: "BE", nameRu: "Бельгия", nameEn: "Belgium", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1000" },
  { code: "BG", nameRu: "Болгария", nameEn: "Bulgaria", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1000" },
  { code: "BY", nameRu: "Беларусь", nameEn: "Belarus", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "220000" },
  { code: "CA", nameRu: "Канада", nameEn: "Canada", postalCodeRegex: "^[A-Z][0-9][A-Z] ?[0-9][A-Z][0-9]$", postalCodeExample: "M5V 3L9" },
  { code: "CH", nameRu: "Швейцария", nameEn: "Switzerland", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "8001" },
  { code: "CN", nameRu: "Китай", nameEn: "China", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "100000" },
  { code: "CY", nameRu: "Кипр", nameEn: "Cyprus", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1010" },
  { code: "CZ", nameRu: "Чехия", nameEn: "Czechia", postalCodeRegex: "^[0-9]{3} ?[0-9]{2}$", postalCodeExample: "110 00" },
  { code: "DE", nameRu: "Германия", nameEn: "Germany", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "10115" },
  { code: "DK", nameRu: "Дания", nameEn: "Denmark", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1050" },
  { code: "DM", nameRu: "Доминика", nameEn: "Dominica", postalCodeRegex: null, postalCodeExample: null },
  { code: "ES", nameRu: "Испания", nameEn: "Spain", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "28013" },
  { code: "ET", nameRu: "Эфиопия", nameEn: "Ethiopia", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1000" },
  { code: "FR", nameRu: "Франция", nameEn: "France", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "75001" },
  { code: "GB", nameRu: "Великобритания", nameEn: "United Kingdom", postalCodeRegex: "^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$", postalCodeExample: "SW1A 1AA" },
  { code: "GE", nameRu: "Грузия", nameEn: "Georgia", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "0100" },
  { code: "GR", nameRu: "Греция", nameEn: "Greece", postalCodeRegex: "^[0-9]{3} ?[0-9]{2}$", postalCodeExample: "104 31" },
  { code: "HU", nameRu: "Венгрия", nameEn: "Hungary", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1011" },
  { code: "ID", nameRu: "Индонезия", nameEn: "Indonesia", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "10110" },
  { code: "IR", nameRu: "Иран", nameEn: "Iran", postalCodeRegex: "^[0-9]{10}$", postalCodeExample: "1111111111" },
  { code: "IS", nameRu: "Исландия", nameEn: "Iceland", postalCodeRegex: "^[0-9]{3}$", postalCodeExample: "101" },
  { code: "IT", nameRu: "Италия", nameEn: "Italy", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "00100" },
  { code: "JP", nameRu: "Япония", nameEn: "Japan", postalCodeRegex: "^[0-9]{3}-[0-9]{4}$", postalCodeExample: "100-0001" },
  { code: "KZ", nameRu: "Казахстан", nameEn: "Kazakhstan", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "010000" },
  { code: "LT", nameRu: "Литва", nameEn: "Lithuania", postalCodeRegex: "^(LT-)?[0-9]{5}$", postalCodeExample: "LT-01100" },
  { code: "LU", nameRu: "Люксембург", nameEn: "Luxembourg", postalCodeRegex: "^(L-)?[0-9]{4}$", postalCodeExample: "L-1009" },
  { code: "LV", nameRu: "Латвия", nameEn: "Latvia", postalCodeRegex: "^(LV-)?[0-9]{4}$", postalCodeExample: "LV-1050" },
  { code: "MC", nameRu: "Монако", nameEn: "Monaco", postalCodeRegex: "^980[0-9]{2}$", postalCodeExample: "98000" },
  { code: "MD", nameRu: "Молдова", nameEn: "Moldova", postalCodeRegex: "^(MD-?)?[0-9]{4}$", postalCodeExample: "MD-2001" },
  { code: "ME", nameRu: "Черногория", nameEn: "Montenegro", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "81000" },
  { code: "MN", nameRu: "Монголия", nameEn: "Mongolia", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "14200" },
  { code: "MT", nameRu: "Мальта", nameEn: "Malta", postalCodeRegex: "^[A-Z]{3} ?[0-9]{4}$", postalCodeExample: "VLT 1117" },
  { code: "MX", nameRu: "Мексика", nameEn: "Mexico", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "06000" },
  { code: "NL", nameRu: "Нидерланды", nameEn: "Netherlands", postalCodeRegex: "^[0-9]{4} ?[A-Z]{2}$", postalCodeExample: "1011 AB" },
  { code: "NO", nameRu: "Норвегия", nameEn: "Norway", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "0150" },
  { code: "NY", nameRu: "США (Нью-Йорк)", nameEn: "USA (New York)", postalCodeRegex: "^1[0-9]{4}$", postalCodeExample: "10001" },
  { code: "PL", nameRu: "Польша", nameEn: "Poland", postalCodeRegex: "^[0-9]{2}-[0-9]{3}$", postalCodeExample: "00-001" },
  { code: "PT", nameRu: "Португалия", nameEn: "Portugal", postalCodeRegex: "^[0-9]{4}-[0-9]{3}$", postalCodeExample: "1000-001" },
  { code: "RO", nameRu: "Румыния", nameEn: "Romania", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "010001" },
  { code: "RS", nameRu: "Сербия", nameEn: "Serbia", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "11000" },
  { code: "RU", nameRu: "Россия", nameEn: "Russia", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "101000" },
  { code: "SA", nameRu: "Саудовская Аравия", nameEn: "Saudi Arabia", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "11564" },
  { code: "SB", nameRu: "Соломоновы Острова", nameEn: "Solomon Islands", postalCodeRegex: null, postalCodeExample: null },
  { code: "SE", nameRu: "Швеция", nameEn: "Sweden", postalCodeRegex: "^[0-9]{3} ?[0-9]{2}$", postalCodeExample: "111 20" },
  { code: "SG", nameRu: "Сингапур", nameEn: "Singapore", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "238858" },
  { code: "SI", nameRu: "Словения", nameEn: "Slovenia", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1000" },
  { code: "TL", nameRu: "Восточный Тимор", nameEn: "Timor-Leste", postalCodeRegex: null, postalCodeExample: null },
  { code: "TR", nameRu: "Турция", nameEn: "Turkey", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "34000" },
  { code: "UA", nameRu: "Украина", nameEn: "Ukraine", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "01001" },
  { code: "US", nameRu: "США", nameEn: "United States", postalCodeRegex: "^[0-9]{5}(-[0-9]{4})?$", postalCodeExample: "10001" },
  { code: "UZ", nameRu: "Узбекистан", nameEn: "Uzbekistan", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "100000" },
  { code: "VT", nameRu: "США (Вермонт)", nameEn: "USA (Vermont)", postalCodeRegex: "^05[0-9]{3}$", postalCodeExample: "05001" },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const seed of COUNTRIES) {
    const existing = await prisma.country.findUnique({ where: { code: seed.code } });
    await prisma.country.upsert({
      where: { code: seed.code },
      update: seed,
      create: seed,
    });
    if (existing) {
      updated++;
    } else {
      created++;
    }
  }

  console.log(`Создано: ${created}`);
  console.log(`Обновлено: ${updated}`);
  console.log(`Всего записей в справочнике: ${COUNTRIES.length}`);

  await prisma.$disconnect();
}

main();
