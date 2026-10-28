import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

// Служебные оповещения владельцу (не клиентам) — в Telegram и в группу WeCom (docs/product/задание-оповещения.md).
// notifyOwner(текст) шлёт во все включённые каналы: ошибка одного не мешает другому и пишется в журнал сервера
// и в настройки (lastError). Несколько событий — одним сообщением: группирует тот, кто зовёт.

export const WECOM_WEBHOOK_RE = /^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[A-Za-z0-9-]{8,100}$/;
export const LINK_CODE_MINUTES = 10;
/** Начало ссылки привязки: t.me/<бот>?start=owner-<код> */
export const OWNER_START = "owner-";

const TELEGRAM_MAX = 4000; // символов (предел Telegram — 4096)
const WECOM_MAX_BYTES = 2000; // байт UTF-8 (предел WeCom — 2048)

export type ChannelResult = "sent" | "off" | "not-set" | "error";
export type NotifyResult = { telegram: ChannelResult; wecom: ChannelResult };

export const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

export async function getOwnerSettings() {
  return prisma.ownerNotificationSettings.findFirst();
}

/** Настройки есть всегда: первая запись — у компании склада (её бренд в админке). */
export async function ensureOwnerSettings() {
  const existing = await getOwnerSettings();
  if (existing) return existing;
  const company = await prisma.company.findFirst({ where: { adminBrand: true }, select: { id: true } });
  return prisma.ownerNotificationSettings.create({ data: { companyId: company?.id ?? null } });
}

function cutBytes(text: string, max: number): string {
  if (Buffer.byteLength(text) <= max) return text;
  // обрезка посреди буквы даёт «�» в конце — убираем; «…» — 3 байта
  return `${Buffer.from(text).subarray(0, max - 3).toString("utf8").replace(/\uFFFD+$/, "")}…`;
}

/** Сообщение в группу WeCom через её бота (только текст). WECOM_API_URL — только для проверки с заглушкой. */
export async function sendWecom(webhook: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.WECOM_API_URL ? webhook.replace("https://qyapi.weixin.qq.com", process.env.WECOM_API_URL) : webhook;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msgtype: "text", text: { content: cutBytes(text, WECOM_MAX_BYTES) } }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { errcode?: number; errmsg?: string };
    if (res.ok && data.errcode === 0) return { ok: true };
    return { ok: false, error: `WeCom ответил: ${data.errcode ?? res.status} ${data.errmsg ?? ""}`.trim() };
  } catch (error) {
    return { ok: false, error: `WeCom не ответил: ${error instanceof Error ? error.message : "ошибка сети"}` };
  }
}

/** Оповестить владельца во всех включённых каналах. Ничего не бросает — вызывающему делу не мешает. */
export async function notifyOwner(text: string): Promise<NotifyResult> {
  const result: NotifyResult = { telegram: "off", wecom: "off" };
  try {
    const s = await getOwnerSettings();
    if (!s) return result;
    const errors: string[] = [];

    if (s.telegramEnabled) {
      if (!s.ownerChatId) result.telegram = "not-set";
      else {
        const sent = await sendTelegramMessage(s.ownerChatId, text.length > TELEGRAM_MAX ? `${text.slice(0, TELEGRAM_MAX)}…` : text);
        result.telegram = sent ? "sent" : "error";
        if (!sent) errors.push("Telegram: сообщение не ушло (журнал сервера — [telegram])");
      }
    }
    if (s.wecomEnabled) {
      if (!s.wecomWebhook) result.wecom = "not-set";
      else {
        const sent = await sendWecom(s.wecomWebhook, text);
        result.wecom = sent.ok ? "sent" : "error";
        if (!sent.ok) errors.push(sent.error ?? "WeCom: ошибка");
      }
    }

    for (const error of errors) console.error("[owner-notify]", error);
    if (result.telegram === "sent" || result.wecom === "sent" || errors.length) {
      await prisma.ownerNotificationSettings.update({
        where: { id: s.id },
        data: { lastSentAt: new Date(), lastError: errors.length ? errors.join("; ").slice(0, 500) : null },
      });
    }
  } catch (error) {
    console.error("[owner-notify]", error);
  }
  return result;
}

/** Новый одноразовый код привязки Telegram владельца (в базе — только его хеш). */
export async function newOwnerLinkCode(updatedBy: string): Promise<{ code: string; expires: Date }> {
  const s = await ensureOwnerSettings();
  const code = randomBytes(18).toString("base64url");
  const expires = new Date(Date.now() + LINK_CODE_MINUTES * 60_000);
  await prisma.ownerNotificationSettings.update({
    where: { id: s.id },
    data: { linkCodeHash: hashCode(code), linkCodeExpires: expires, updatedBy },
  });
  return { code, expires };
}

/**
 * Владелец нажал «Старт» по ссылке привязки: код верный и не истёк — этот чат становится чатом владельца.
 * Код срабатывает один раз. Неверный или старый код — ничего не меняется.
 */
export async function bindOwnerChat(code: string, chat: { id: string; name: string | null }): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(code)) return false;
  const now = new Date();
  const updated = await prisma.ownerNotificationSettings.updateMany({
    where: { linkCodeHash: hashCode(code), linkCodeExpires: { gt: now } },
    data: { ownerChatId: chat.id, ownerChatName: chat.name, ownerLinkedAt: now, linkCodeHash: null, linkCodeExpires: null, telegramEnabled: true },
  });
  return updated.count > 0;
}
