import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

type PriceValue = number | string | { toNumber(): number } | null | undefined;

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const usdFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const cnyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("ru-RU");

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function toNumber(value: PriceValue): number {
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return value.toNumber();
  }
  return Number(value ?? 0);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(value: PriceValue): string {
  return usdFormatter.format(toNumber(value));
}

export function formatCny(value: PriceValue): string {
  return cnyFormatter.format(toNumber(value));
}

export const formatPrice = formatUsd;

export function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

export function formatDate(date: Date | string): string {
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return dateTimeFormatter.format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, (char) => CYRILLIC_TO_LATIN[char] ?? char)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const orderStatusLabel: Record<string, string> = {
  new: "Новый",
  paid: "Оплачен",
  shipped: "Отправлен",
  completed: "Завершен",
  cancelled: "Отменен",
};

export const orderStatusTone: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  paid: "bg-emerald-100 text-emerald-800",
  shipped: "bg-violet-100 text-violet-800",
  completed: "bg-slate-200 text-slate-800",
  cancelled: "bg-rose-100 text-rose-800",
};
