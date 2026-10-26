// Бренд — как система называет себя на экране: название, логотип, сайт, цвета. Берётся из компании
// («Администрирование → Компании»), не из кода. Общий модуль для сервера и браузера: без обращения к базе.
import type { CSSProperties } from "react";

export type Brand = {
  name: string;
  tagline: string | null;
  siteUrl: string | null;
  trackingUrl: string | null;
  logoUrl: string | null; // логотип с надписью
  iconUrl: string | null; // знак без надписи
  primaryColor: string | null; // #RRGGBB; пусто — стандартный вид
  accentColor: string | null;
};

/** Цвет из настроек компании, только вида #RRGGBB: другое значение не попадёт в стили страницы. */
export function brandColor(value: string | null | undefined): string | null {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

/** Светлый ли цвет: на светлом пишем тёмным, на тёмном — светлым. */
function isLight(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

/** Цвета админки из компании-склада: основной цвет — кнопки, ссылки, выделение. Пусто — стандартные цвета. */
export function adminThemeCss(brand: Brand): string {
  const primary = brandColor(brand.primaryColor);
  if (!primary) return "";
  const text = isLight(primary) ? "#1f1a14" : "#fffaf3";
  return `:root { --color-accent: ${primary}; --color-accent-hover: color-mix(in srgb, ${primary} 80%, black); --color-accent-fg: ${text}; }`;
}

/** Цвета кабинета из компании клиентов: основной и второй с более тёмным и более светлым оттенками. */
export function cabinetThemeStyle(brand: Brand): CSSProperties {
  const primary = brandColor(brand.primaryColor);
  const accent = brandColor(brand.accentColor);
  const vars: Record<string, string> = {
    ...(primary ? { "--cab-green": primary, "--cab-green-deep": `color-mix(in srgb, ${primary} 75%, black)` } : {}),
    ...(accent ? { "--cab-orange": accent, "--cab-orange-light": `color-mix(in srgb, ${accent} 80%, white)` } : {}),
  };
  return vars as CSSProperties;
}

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
