import { prisma } from "../lib/prisma";

type CountrySeed = {
  code: string;
  nameRu: string;
  nameEn: string;
  phoneCode: string;
  postalCodeRegex: string | null;
  postalCodeExample: string | null;
};

const COUNTRIES: CountrySeed[] = [
  { code: "AE", nameRu: "ОАЭ", nameEn: "United Arab Emirates", phoneCode: "+971", postalCodeRegex: null, postalCodeExample: null },
  { code: "AT", nameRu: "Австрия", nameEn: "Austria", phoneCode: "+43", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1010" },
  { code: "AU", nameRu: "Австралия", nameEn: "Australia", phoneCode: "+61", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "2000" },
  { code: "BE", nameRu: "Бельгия", nameEn: "Belgium", phoneCode: "+32", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1000" },
  { code: "BG", nameRu: "Болгария", nameEn: "Bulgaria", phoneCode: "+359", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1000" },
  { code: "BY", nameRu: "Беларусь", nameEn: "Belarus", phoneCode: "+375", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "220000" },
  { code: "CA", nameRu: "Канада", nameEn: "Canada", phoneCode: "+1", postalCodeRegex: "^[A-Z][0-9][A-Z] ?[0-9][A-Z][0-9]$", postalCodeExample: "M5V 3L9" },
  { code: "CH", nameRu: "Швейцария", nameEn: "Switzerland", phoneCode: "+41", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "8001" },
  { code: "CN", nameRu: "Китай", nameEn: "China", phoneCode: "+86", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "100000" },
  { code: "CY", nameRu: "Кипр", nameEn: "Cyprus", phoneCode: "+357", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1010" },
  { code: "CZ", nameRu: "Чехия", nameEn: "Czechia", phoneCode: "+420", postalCodeRegex: "^[0-9]{3} ?[0-9]{2}$", postalCodeExample: "110 00" },
  { code: "DE", nameRu: "Германия", nameEn: "Germany", phoneCode: "+49", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "10115" },
  { code: "DK", nameRu: "Дания", nameEn: "Denmark", phoneCode: "+45", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1050" },
  { code: "DM", nameRu: "Доминика", nameEn: "Dominica", phoneCode: "+1767", postalCodeRegex: null, postalCodeExample: null },
  { code: "EE", nameRu: "Эстония", nameEn: "Estonia", phoneCode: "+372", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "10111" },
  { code: "ES", nameRu: "Испания", nameEn: "Spain", phoneCode: "+34", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "28013" },
  { code: "ET", nameRu: "Эфиопия", nameEn: "Ethiopia", phoneCode: "+251", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1000" },
  { code: "FI", nameRu: "Финляндия", nameEn: "Finland", phoneCode: "+358", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "00100" },
  { code: "FR", nameRu: "Франция", nameEn: "France", phoneCode: "+33", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "75001" },
  { code: "GB", nameRu: "Великобритания", nameEn: "United Kingdom", phoneCode: "+44", postalCodeRegex: "^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$", postalCodeExample: "SW1A 1AA" },
  { code: "GE", nameRu: "Грузия", nameEn: "Georgia", phoneCode: "+995", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "0100" },
  { code: "GR", nameRu: "Греция", nameEn: "Greece", phoneCode: "+30", postalCodeRegex: "^[0-9]{3} ?[0-9]{2}$", postalCodeExample: "104 31" },
  { code: "HR", nameRu: "Хорватия", nameEn: "Croatia", phoneCode: "+385", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "10000" },
  { code: "HU", nameRu: "Венгрия", nameEn: "Hungary", phoneCode: "+36", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1011" },
  { code: "ID", nameRu: "Индонезия", nameEn: "Indonesia", phoneCode: "+62", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "10110" },
  { code: "IE", nameRu: "Ирландия", nameEn: "Ireland", phoneCode: "+353", postalCodeRegex: null, postalCodeExample: "D02 AF30" },
  { code: "IR", nameRu: "Иран", nameEn: "Iran", phoneCode: "+98", postalCodeRegex: "^[0-9]{10}$", postalCodeExample: "1111111111" },
  { code: "IS", nameRu: "Исландия", nameEn: "Iceland", phoneCode: "+354", postalCodeRegex: "^[0-9]{3}$", postalCodeExample: "101" },
  { code: "IT", nameRu: "Италия", nameEn: "Italy", phoneCode: "+39", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "00100" },
  { code: "JP", nameRu: "Япония", nameEn: "Japan", phoneCode: "+81", postalCodeRegex: "^[0-9]{3}-[0-9]{4}$", postalCodeExample: "100-0001" },
  { code: "KZ", nameRu: "Казахстан", nameEn: "Kazakhstan", phoneCode: "+7", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "010000" },
  { code: "LT", nameRu: "Литва", nameEn: "Lithuania", phoneCode: "+370", postalCodeRegex: "^(LT-)?[0-9]{5}$", postalCodeExample: "LT-01100" },
  { code: "LU", nameRu: "Люксембург", nameEn: "Luxembourg", phoneCode: "+352", postalCodeRegex: "^(L-)?[0-9]{4}$", postalCodeExample: "L-1009" },
  { code: "LV", nameRu: "Латвия", nameEn: "Latvia", phoneCode: "+371", postalCodeRegex: "^(LV-)?[0-9]{4}$", postalCodeExample: "LV-1050" },
  { code: "MC", nameRu: "Монако", nameEn: "Monaco", phoneCode: "+377", postalCodeRegex: "^980[0-9]{2}$", postalCodeExample: "98000" },
  { code: "MD", nameRu: "Молдова", nameEn: "Moldova", phoneCode: "+373", postalCodeRegex: "^(MD-?)?[0-9]{4}$", postalCodeExample: "MD-2001" },
  { code: "ME", nameRu: "Черногория", nameEn: "Montenegro", phoneCode: "+382", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "81000" },
  { code: "MN", nameRu: "Монголия", nameEn: "Mongolia", phoneCode: "+976", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "14200" },
  { code: "MT", nameRu: "Мальта", nameEn: "Malta", phoneCode: "+356", postalCodeRegex: "^[A-Z]{3} ?[0-9]{4}$", postalCodeExample: "VLT 1117" },
  { code: "MX", nameRu: "Мексика", nameEn: "Mexico", phoneCode: "+52", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "06000" },
  { code: "NL", nameRu: "Нидерланды", nameEn: "Netherlands", phoneCode: "+31", postalCodeRegex: "^[0-9]{4} ?[A-Z]{2}$", postalCodeExample: "1011 AB" },
  { code: "NO", nameRu: "Норвегия", nameEn: "Norway", phoneCode: "+47", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "0150" },
  { code: "NY", nameRu: "США (Нью-Йорк)", nameEn: "USA (New York)", phoneCode: "+1", postalCodeRegex: "^1[0-9]{4}$", postalCodeExample: "10001" },
  { code: "PL", nameRu: "Польша", nameEn: "Poland", phoneCode: "+48", postalCodeRegex: "^[0-9]{2}-[0-9]{3}$", postalCodeExample: "00-001" },
  { code: "PT", nameRu: "Португалия", nameEn: "Portugal", phoneCode: "+351", postalCodeRegex: "^[0-9]{4}-[0-9]{3}$", postalCodeExample: "1000-001" },
  { code: "RO", nameRu: "Румыния", nameEn: "Romania", phoneCode: "+40", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "010001" },
  { code: "RS", nameRu: "Сербия", nameEn: "Serbia", phoneCode: "+381", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "11000" },
  { code: "RU", nameRu: "Россия", nameEn: "Russia", phoneCode: "+7", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "101000" },
  { code: "SA", nameRu: "Саудовская Аравия", nameEn: "Saudi Arabia", phoneCode: "+966", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "11564" },
  { code: "SB", nameRu: "Соломоновы Острова", nameEn: "Solomon Islands", phoneCode: "+677", postalCodeRegex: null, postalCodeExample: null },
  { code: "SE", nameRu: "Швеция", nameEn: "Sweden", phoneCode: "+46", postalCodeRegex: "^[0-9]{3} ?[0-9]{2}$", postalCodeExample: "111 20" },
  { code: "SG", nameRu: "Сингапур", nameEn: "Singapore", phoneCode: "+65", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "238858" },
  { code: "SI", nameRu: "Словения", nameEn: "Slovenia", phoneCode: "+386", postalCodeRegex: "^[0-9]{4}$", postalCodeExample: "1000" },
  { code: "SK", nameRu: "Словакия", nameEn: "Slovakia", phoneCode: "+421", postalCodeRegex: "^[0-9]{3} ?[0-9]{2}$", postalCodeExample: "811 01" },
  { code: "TL", nameRu: "Восточный Тимор", nameEn: "Timor-Leste", phoneCode: "+670", postalCodeRegex: null, postalCodeExample: null },
  { code: "TR", nameRu: "Турция", nameEn: "Turkey", phoneCode: "+90", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "34000" },
  { code: "UA", nameRu: "Украина", nameEn: "Ukraine", phoneCode: "+380", postalCodeRegex: "^[0-9]{5}$", postalCodeExample: "01001" },
  { code: "US", nameRu: "США", nameEn: "United States", phoneCode: "+1", postalCodeRegex: "^[0-9]{5}(-[0-9]{4})?$", postalCodeExample: "10001" },
  { code: "UZ", nameRu: "Узбекистан", nameEn: "Uzbekistan", phoneCode: "+998", postalCodeRegex: "^[0-9]{6}$", postalCodeExample: "100000" },
  { code: "VT", nameRu: "США (Вермонт)", nameEn: "USA (Vermont)", phoneCode: "+1", postalCodeRegex: "^05[0-9]{3}$", postalCodeExample: "05001" },
];

// ЕС-27 (без Великобритании; Швейцария/Норвегия/Исландия — EEA, не ЕС).
const EU_CODES = new Set<string>([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

async function main() {
  let created = 0;
  let updated = 0;

  for (const base of COUNTRIES) {
    const seed = { ...base, isEu: EU_CODES.has(base.code) };
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
