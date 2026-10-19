// Проверка ответа ИИ-разборщика по исходному тексту ячейки Excel: всё ли, что вернул ИИ, действительно есть в тексте,
// и нет ли в тексте трек-номеров, которые ИИ пропустил. Без обращения к базе и ИИ — чистые функции.

/** Текст для сравнения: строчные, ё → е, только буквы и цифры. */
export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Цифровые последовательности текста; пробелы, дефисы, скобки и точки внутри номера не разрывают его. */
function digitRuns(source: string): string[] {
  return source.replace(/(\d)[\s\-().]+(?=\d)/g, "$1").match(/\d+/g) ?? [];
}

/** Значение есть в тексте: для номеров и телефонов — по цифрам, для остального — по буквам и цифрам. */
export function foundInText(value: string, source: string, kind: "text" | "digits" = "text"): boolean {
  if (kind === "digits") {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 5 && digitRuns(source).some((run) => run.includes(digits));
  }
  const needle = normalizeText(value);
  return needle.length > 0 && normalizeText(source).includes(needle);
}

/** Адрес есть в тексте, если в тексте есть почти все его слова (порядок и знаки препинания у ИИ могут отличаться). */
export function addressInText(address: string, source: string): boolean {
  const words = address.split(/[\s,;]+/).map(normalizeText).filter((w) => w.length >= 3);
  if (!words.length) return false;
  const haystack = normalizeText(source);
  return words.filter((w) => haystack.includes(w)).length / words.length >= 0.8;
}

/** Цена есть в тексте — за штуку или за всё количество. */
export function priceInText(price: number, quantity: number, source: string): boolean {
  const numbers = (source.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", ".")));
  return numbers.some((n) => Math.abs(n - price) < 0.01 || Math.abs(n - price * quantity) < 0.01);
}

/**
 * Похожие на трек-номер слова текста: 10–25 букв и цифр, цифр не меньше 8, букв не больше 6.
 * Телефоны (со знаком «+» перед номером) не считаются.
 */
export function trackCandidates(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(/(\+?)([A-Za-z0-9]{10,25})/g)) {
    if (match[1]) continue;
    const token = match[2].toUpperCase();
    const digitCount = token.replace(/\D/g, "").length;
    if (digitCount >= 8 && token.length - digitCount <= 6) found.add(token);
  }
  return [...found];
}

/** Трек-номера из текста, которых нет среди найденных ИИ и которые не совпадают с телефоном. */
export function missedTracks(source: string, tracks: (string | null)[], phones: (string | null)[]): string[] {
  const known = tracks.filter((t): t is string => Boolean(t)).map((t) => t.replace(/\s+/g, "").toUpperCase());
  const phoneDigits = phones.filter((p): p is string => Boolean(p)).map((p) => p.replace(/\D/g, ""));
  return trackCandidates(source).filter(
    (candidate) =>
      !known.some((t) => t.includes(candidate) || candidate.includes(t)) &&
      !phoneDigits.some((p) => p.length >= 7 && (p.includes(candidate) || candidate.includes(p))),
  );
}
