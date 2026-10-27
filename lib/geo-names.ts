// Страны и города клиентов и получателей — по-английски (решение владельца 2026-10-27): страна — только из справочника
// стран (Country.nameEn), город — английское название. Общий модуль: действия админки и скрипт обновления базы.

export type CountryRef = { code: string; nameRu: string; nameEn: string; aliases: string | null };
/** same — уже латиницей; map — с карты; letters — на карте нет, по буквам; offline — карта не ответила, по буквам. */
export type EnglishCity = { name: string; source: "same" | "map" | "letters" | "offline" };

// Псевдо-коды справочника → настоящий ISO2 страны (для геосервиса).
const CODE_TO_ISO2: Record<string, string> = { NY: "US", VT: "US" };

export function toIso2(code: string): string {
  return (CODE_TO_ISO2[code.toUpperCase()] ?? code).toLowerCase();
}

export function hasCyrillic(text: string | null | undefined): boolean {
  return /[Ѐ-ӿ]/.test(text ?? "");
}

const norm = (text: string) => text.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

const namesOf = (c: CountryRef) => [c.nameRu, c.nameEn, ...(c.aliases?.split(",") ?? [])].map(norm).filter(Boolean);

/**
 * Страна из справочника: по коду (DE), по названию по-русски или по-английски, по другому названию (USA, РФ).
 * Опечатка в одну букву тоже находится, если похожая страна одна («Молдава» → Moldova).
 */
export function matchCountry(input: string | null | undefined, countries: CountryRef[]): CountryRef | null {
  const text = norm(input ?? "");
  if (!text) return null;
  if (/^[a-z]{2}$/.test(text)) {
    const byCode = countries.find((c) => c.code.toLowerCase() === text);
    if (byCode) return byCode;
  }
  const exact = countries.find((c) => namesOf(c).includes(text));
  if (exact) return exact;
  if (text.length < 5) return null;
  const close = countries.filter((c) => namesOf(c).some((name) => Math.abs(name.length - text.length) <= 1 && distance(name, text) <= 1));
  return close.length === 1 ? close[0] : null;
}

// Русские и украинские буквы → латиница (для города, который не нашёлся на карте).
const LETTERS: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g",
};

/** Кириллица по буквам латиницей, с заглавными там же: «Ужгород» → «Uzhgorod». */
export function transliterate(text: string): string {
  return [...text]
    .map((ch) => {
      const lower = ch.toLowerCase();
      const latin = LETTERS[lower];
      if (latin === undefined) return ch;
      return ch !== lower && latin ? latin[0].toUpperCase() + latin.slice(1) : latin;
    })
    .join("");
}

const cache = new Map<string, string | null>();
let lastCall = 0;

/**
 * Английское название места на карте OpenStreetMap (Nominatim): не чаще раза в секунду, как просит сервис.
 * null — на карте нет; undefined — карта не ответила (не запоминается, спросим в следующий раз).
 */
async function mapName(city: string, iso2: string | null): Promise<string | null | undefined> {
  const key = `${iso2 ?? ""}|${city.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const wait = lastCall + 1100 - Date.now();
  lastCall = Date.now() + Math.max(wait, 0);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  const url = new URL(process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", "en");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", city);
  if (iso2) url.searchParams.set("countrycodes", iso2);
  let name: string | null;
  try {
    const res = await fetch(url, {
      // Nominatim просит своё имя программы в User-Agent; адрес приложения — из настроек сервера
      headers: { "User-Agent": `Admin-panel/1.0 (city names${process.env.NEXT_PUBLIC_APP_URL ? `; ${process.env.NEXT_PUBLIC_APP_URL}` : ""})` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { name?: string }[];
    const found = Array.isArray(data) ? data[0]?.name?.trim() : undefined;
    name = found && !hasCyrillic(found) ? found : null;
  } catch {
    return undefined;
  }
  cache.set(key, name);
  return name;
}

/**
 * Английское название города. Латиницей — как есть; кириллицей — с карты OpenStreetMap в выбранной стране
 * («Гуанчжоу» → Guangzhou), а не нашлось — по буквам («Ужгород» → Uzhgorod).
 */
export async function englishCity(city: string, countryCode: string | null | undefined): Promise<EnglishCity> {
  const text = city.trim().replace(/\s+/g, " ");
  if (!hasCyrillic(text)) return { name: text, source: "same" };
  const found = await mapName(text, countryCode ? toIso2(countryCode) : null);
  if (found) return { name: found, source: "map" };
  return { name: transliterate(text), source: found === null ? "letters" : "offline" };
}
