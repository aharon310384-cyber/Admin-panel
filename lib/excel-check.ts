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

/**
 * Трек посылки до получателя, а не входящий из Китая: почтовый международный (CB772705834DE, EV071583494CN, LC…MG),
 * DHL Германии (00340…, 20 цифр), Meest (MGRMY…).
 */
export function isParcelTrack(token: string): boolean {
  const t = token.toUpperCase();
  return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(t) || /^00340\d{15,17}$/.test(t) || /^MGRMY\d+[A-Z]{0,3}$/.test(t);
}

/** Входящие трек-номера из текста, которых нет среди найденных ИИ и которые не совпадают с телефоном и треком посылки. */
export function missedTracks(source: string, tracks: (string | null)[], phones: (string | null)[]): string[] {
  const known = tracks.filter((t): t is string => Boolean(t)).map((t) => t.replace(/\s+/g, "").toUpperCase());
  const phoneDigits = phones.filter((p): p is string => Boolean(p)).map((p) => p.replace(/\D/g, ""));
  return trackCandidates(source).filter(
    (candidate) =>
      !isParcelTrack(candidate) &&
      !known.some((t) => t.includes(candidate) || candidate.includes(t)) &&
      !phoneDigits.some((p) => p.length >= 7 && (p.includes(candidate) || candidate.includes(p))),
  );
}

/** Одно и то же ФИО в любом порядке слов: «Olga Efimova» = «Efimova Olga». */
export function sameName(a: string, b: string): boolean {
  const words = (value: string) => value.split(/\s+/).map(normalizeText).filter(Boolean).sort().join(" ");
  const left = words(a);
  return left.length > 0 && left === words(b);
}

// Кириллица, похожая на латиницу: код клиента «КС», набранный русскими буквами, — это «KC».
const LOOKALIKE: Record<string, string> = { А: "A", В: "B", С: "C", Е: "E", Н: "H", К: "K", М: "M", О: "O", Р: "P", Т: "T", Х: "X", У: "Y" };

/** Код клиента для сравнения: заглавные латинские, похожая кириллица — латиницей, без пробелов. */
export function latinCode(value: string | null | undefined): string {
  return [...(value ?? "").toUpperCase().replace(/\s+/g, "")].map((ch) => LOOKALIKE[ch] ?? ch).join("");
}
