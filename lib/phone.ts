/** Нормализация телефона: только цифры. */
export function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Сравнение двух телефонов по последним 10 значащим цифрам
 * (устойчиво к различиям в коде страны/формате: +7, 8, пробелы, скобки).
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na.length < 10 || nb.length < 10) return false;
  return na.slice(-10) === nb.slice(-10);
}
