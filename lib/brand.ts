// Бренд — как система называет себя на экране: название, логотип, сайт. Берётся из компании
// («Администрирование → Компании»), не из кода. Общий модуль для сервера и браузера: без обращения к базе.

export type Brand = {
  name: string;
  tagline: string | null;
  siteUrl: string | null;
  trackingUrl: string | null;
  logoUrl: string | null; // логотип с надписью
  iconUrl: string | null; // знак без надписи
};

export type CompanyImage = "logo" | "icon";
export const COMPANY_IMAGES: CompanyImage[] = ["logo", "icon"];

/** Адрес сайта для подписи: «example.com» из «https://www.example.com/ru/». */
export function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Две части названия для надписи: «MyCargo» → «My» + «Cargo», «Cargo Line» → «Cargo » + «Line». Вторая — акцентом. */
export function wordmarkParts(name: string): [string, string] {
  const text = name.trim();
  const space = text.lastIndexOf(" ");
  if (space > 0) return [text.slice(0, space + 1), text.slice(space + 1)];
  for (let index = text.length - 1; index > 0; index -= 1) {
    const char = text[index];
    if (char !== char.toLowerCase() && text[index - 1] === text[index - 1].toLowerCase()) {
      return [text.slice(0, index), text.slice(index)];
    }
  }
  return [text, ""];
}

/** Буквы для знака, когда картинки нет: «MyCargo» → «MC», «Склад» → «СК». */
export function brandInitials(name: string): string {
  const [first, second] = wordmarkParts(name).map((part) => part.trim());
  const letters = second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2);
  return letters.toUpperCase();
}

/** Описание страниц кабинета: «Личный кабинет клиента <название> — <коротко о компании>». */
export function cabinetDescription(brand: Brand): string {
  return `Личный кабинет клиента ${brand.name}${brand.tagline ? ` — ${brand.tagline}` : ""}`;
}
