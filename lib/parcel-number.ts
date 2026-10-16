import { prisma } from "@/lib/prisma";
import { isDocumentNumber } from "@/lib/document-numbers";

/**
 * Номер задачи на формирование посылки: «ИД клиента + сквозной номер + код страны доставки»
 * (например SM3956US, где SM — код клиента, 3956 — сквозной номер, US — страна).
 * Сама посылка нумеруется как документ: PS-000001 (lib/document-numbers.ts).
 *
 * Сквозной номер глобальный: берётся максимальное числовое ядро среди ВСЕХ
 * существующих номеров задач (в любом формате — составном SM3956US, историческом
 * GZ623988DE или служебном PF000123) и увеличивается на единицу. Так нумерация
 * монотонна и не конфликтует с импортированными историческими номерами.
 */

/** Достаёт сквозной серийный номер из номера любого формата. */
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

/**
 * Разбирает номер из Excel вида «AT1536DE 01 DHL» на номер задачи, страну и приписку.
 * Номер не в составном формате (PF000123, произвольный текст) возвращается как есть.
 */
export function splitLegacyTaskNumber(raw: string): { number: string; country: string | null; tail: string | null } {
  const value = raw.trim();
  const match = /^([A-Za-z]+?)(\d+)([A-Za-z]{2,4})(?=$|[^A-Za-z0-9])(.*)$/.exec(value);
  if (!match) return { number: value, country: null, tail: null };
  const tail = match[4].replace(/^[\s\-_/]+/, "").trim();
  return {
    number: `${match[1]}${match[2]}${match[3]}`.toUpperCase(),
    country: match[3].toUpperCase(),
    tail: tail || null,
  };
}

export async function nextParcelTaskNumber(customerCode: string, countryCode: string): Promise<string> {
  const code = customerCode.trim().toUpperCase();
  const country = countryCode.trim().toUpperCase();
  if (!code) throw new Error("Не задан код клиента для номера задачи");
  if (!country) throw new Error("Не задан код страны доставки для номера задачи");

  // Номера задач + номера посылок, которые ещё не перенесены в задачи (до скрипта обновления).
  const [tasks, parcels] = await Promise.all([
    prisma.parcelTask.findMany({ select: { number: true } }),
    prisma.parcel.findMany({ where: { parcelTaskId: null }, select: { number: true } }),
  ]);
  let max = 0;
  for (const { number } of [...tasks, ...parcels]) {
    if (isDocumentNumber("parcel", number)) continue;
    const n = serialOf(number);
    if (n > max) max = n;
  }

  // Защита от коллизий по уникальному ParcelTask.number
  let serial = max + 1;
  let candidate = `${code}${serial}${country}`;
  while (await prisma.parcelTask.findFirst({ where: { number: candidate }, select: { id: true } })) {
    serial++;
    candidate = `${code}${serial}${country}`;
  }
  return candidate;
}

/** Номер, который видит клиент: номер задачи (SM3956US), а если её нет — номер посылки. */
export function clientParcelNumber(parcel: { number: string; parcelTask?: { number: string } | null }): string {
  return parcel.parcelTask?.number ?? parcel.number;
}
