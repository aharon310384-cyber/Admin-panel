import { prisma } from "@/lib/prisma";

/**
 * Составной номер посылки: «ИД клиента + сквозной номер + код страны доставки»
 * (например SM3956US, где SM — код клиента, 3956 — сквозной номер, US — страна).
 *
 * Сквозной номер глобальный: берётся максимальное числовое ядро среди ВСЕХ
 * существующих номеров (в любом формате — составном SM3956US, историческом
 * GZ623988DE или служебном PF000123) и увеличивается на единицу. Так нумерация
 * монотонна и не конфликтует с импортированными историческими номерами.
 */

/** Достаёт сквозной серийный номер из номера посылки любого формата. */
function serialOf(raw: string | null | undefined): number {
  const s = raw?.trim().toUpperCase();
  if (!s) return 0;
  // Составной формат: КОД(буквы) + ЦИФРЫ + СТРАНА(2–4 буквы) — SM3956US, GZ623988DE
  const composed = /^([A-Z]+?)(\d+)([A-Z]{2,4})$/.exec(s);
  if (composed) return parseInt(composed[2], 10) || 0;
  // Служебный формат PF + цифры (исторический дев)
  const pf = /^PF(\d+)$/.exec(s);
  if (pf) return parseInt(pf[1], 10) || 0;
  // Прочее: первая группа цифр
  const any = s.match(/\d+/)?.[0];
  return any ? parseInt(any, 10) || 0 : 0;
}

export async function nextParcelNumber(customerCode: string, countryCode: string): Promise<string> {
  const code = customerCode.trim().toUpperCase();
  const country = countryCode.trim().toUpperCase();
  if (!code) throw new Error("Не задан код клиента для номера посылки");
  if (!country) throw new Error("Не задан код страны доставки для номера посылки");

  const parcels = await prisma.parcel.findMany({ select: { number: true } });
  let max = 0;
  for (const { number } of parcels) {
    const n = serialOf(number);
    if (n > max) max = n;
  }

  // Защита от коллизий по уникальному Parcel.number
  let serial = max + 1;
  let candidate = `${code}${serial}${country}`;
  while (await prisma.parcel.findFirst({ where: { number: candidate }, select: { id: true } })) {
    serial++;
    candidate = `${code}${serial}${country}`;
  }
  return candidate;
}
