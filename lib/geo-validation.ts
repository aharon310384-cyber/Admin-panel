import "server-only";

/** Возвращает количество цифр в номере (без учёта пробелов, скобок, дефисов и т.п.). */
export function countPhoneDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/**
 * Строгая проверка длины национального номера (без кода страны).
 * true — длина в допустимом диапазоне [min, max]. Если границы неизвестны — не проверяем (true).
 */
export function isPhoneLengthValid(
  phone: string,
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  if (min == null || max == null) return true;
  const digits = countPhoneDigits(phone);
  return digits >= min && digits <= max;
}

// Псевдо-коды справочника → реальный ISO2 страны (для геосервиса).
const CODE_TO_ISO2: Record<string, string> = {
  NY: "US",
  VT: "US",
};

function toIso2(code: string): string {
  return (CODE_TO_ISO2[code] ?? code).toLowerCase();
}

export type CityCheckResult = "ok" | "mismatch" | "unknown";

type NominatimItem = { address?: { country_code?: string } };

async function nominatim(params: Record<string, string>): Promise<NominatimItem[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ru,en");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Postmanfox-Admin/1.0 (recipient city validation)" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimItem[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Проверка соответствия города стране через OpenStreetMap/Nominatim.
 * Блокируем ТОЛЬКО при явном противоречии: города нет в выбранной стране,
 * но он однозначно есть в другой. При недоступности сервиса / неизвестном
 * городе возвращаем "unknown" (не мешаем сохранению).
 */
export async function checkCityCountry(
  city: string,
  countryCode: string,
): Promise<CityCheckResult> {
  const trimmed = city.trim();
  if (!trimmed) return "unknown";
  const expected = toIso2(countryCode);

  // 1) Есть ли город в выбранной стране? (свободный запрос — лучше понимает
  //    локализованные/транслитерированные названия, чем структурный city=)
  const inCountry = await nominatim({ q: trimmed, countrycodes: expected, limit: "1" });
  if (inCountry.length > 0) return "ok";

  // 2) Есть ли город где-то ещё? Блокируем, только если он однозначно в другой стране.
  const anywhere = await nominatim({ q: trimmed, limit: "8" });
  const foundCodes = new Set(
    anywhere.map((i) => i.address?.country_code).filter((c): c is string => Boolean(c)),
  );
  if (foundCodes.size === 0) return "unknown"; // город неизвестен — не блокируем
  if (foundCodes.has(expected)) return "ok"; // всё-таки нашёлся в стране
  return "mismatch"; // город есть, но только в других странах
}
