import "server-only";

import path from "node:path";

// Вложения выкупа и пополнения: скриншоты, QR-коды продавца, фото товара, скриншоты оплаты.
// Лежат не в public, а в data/uploads/buyouts (каталог data переживает деплой): чужой клиент их не откроет.
// Отдаёт их /api/buyouts/files/<имя> — сотруднику и клиенту-владельцу. Имя начинается с id клиента: так видно, чей файл.

export const BUYOUT_FILE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const BUYOUT_FILE_MAX = 5 * 1024 * 1024; // 5 МБ
export const BUYOUT_FILES_MAX = 5; // вложений в заявке

const NAME_RE = /^(c[a-z0-9]{20,32})-([a-z0-9]{16,40})\.(jpg|png|webp|gif)$/;
const URL_PREFIX = "/api/buyouts/files/";

export function buyoutFilesDir() {
  const configured = process.env.PRIVATE_UPLOAD_DIR ?? "data/uploads";
  const base = path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  return path.join(base, "buyouts");
}

export function newBuyoutFileName(customerId: string, ext: string) {
  const random = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.toLowerCase();
  return `${customerId}-${random}.${ext}`;
}

/** Имя файла верное — вернуть id клиента-владельца; иначе null. */
export function buyoutFileOwner(name: string): string | null {
  return NAME_RE.exec(name)?.[1] ?? null;
}

export const buyoutFileUrl = (name: string) => `${URL_PREFIX}${name}`;

/** Адрес вложения выкупа этого клиента (загружен через /api/buyouts/files) — иначе null. */
export function ownBuyoutFileUrl(url: unknown, customerId: string): string | null {
  if (typeof url !== "string" || !url.startsWith(URL_PREFIX)) return null;
  const name = url.slice(URL_PREFIX.length);
  return buyoutFileOwner(name) === customerId ? url : null;
}

export type BuyoutAttachment = { url: string; name: string };

/** Вложения из базы (Json) — только правильные записи. */
export function readAttachments(raw: unknown): BuyoutAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is BuyoutAttachment => Boolean(item) && typeof item.url === "string" && typeof item.name === "string")
    .map((item) => ({ url: item.url, name: item.name }));
}

/** Вложения из формы (JSON-строка [{url,name}]): только файлы этого клиента, не больше BUYOUT_FILES_MAX. */
export function attachmentsFromForm(value: FormDataEntryValue | null, customerId: string): BuyoutAttachment[] {
  if (typeof value !== "string" || !value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  return readAttachments(parsed)
    .map((item) => ({ url: ownBuyoutFileUrl(item.url, customerId), name: item.name.trim().slice(0, 120) || "файл" }))
    .filter((item): item is BuyoutAttachment => item.url !== null)
    .slice(0, BUYOUT_FILES_MAX);
}
