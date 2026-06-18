import crypto from "node:crypto";

/**
 * Серверные утилиты для интеграции с Telegram-ботом.
 *
 * Переменные окружения:
 *   TELEGRAM_BOT_TOKEN              — токен бота от BotFather (СЕКРЕТ, только сервер)
 *   NEXT_PUBLIC_TELEGRAM_BOT_NAME   — @username бота без @ (публичное, для ссылок/виджета)
 *
 * На этапе разработки используем ТЕСТОВОГО бота, не боевой.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export function isTelegramConfigured(): boolean {
  return Boolean(BOT_TOKEN);
}

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

/**
 * Проверяет подпись initData из Telegram Mini App (WebApp).
 * Возвращает разобранные данные пользователя при валидной подписи, иначе null.
 * Алгоритм: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(
  initData: string,
  maxAgeSeconds = 86400
): { user: TelegramUser; authDate: number } | null {
  if (!BOT_TOKEN || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Сравнение в постоянном времени
  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate) return null;
  if (maxAgeSeconds > 0 && Date.now() / 1000 - authDate > maxAgeSeconds) {
    return null;
  }

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    const user = JSON.parse(userRaw) as TelegramUser;
    if (!user.id) return null;
    return { user, authDate };
  } catch {
    return null;
  }
}

/**
 * Проверяет подпись данных Telegram Login Widget (для входа из обычного браузера).
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyLoginWidget(
  data: Record<string, string>,
  maxAgeSeconds = 86400
): TelegramUser | null {
  if (!BOT_TOKEN) return null;
  const { hash, ...rest } = data;
  if (!hash) return null;

  const dataCheckString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(rest.auth_date ?? 0);
  if (maxAgeSeconds > 0 && Date.now() / 1000 - authDate > maxAgeSeconds) {
    return null;
  }

  return {
    id: Number(rest.id),
    first_name: rest.first_name,
    last_name: rest.last_name,
    username: rest.username,
    photo_url: rest.photo_url,
  };
}

/** Отправляет текстовое сообщение в чат через Bot API. */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: {
    parseMode?: "HTML" | "MarkdownV2";
    disablePreview?: boolean;
    replyMarkup?: unknown;
  }
): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN не задан — сообщение не отправлено");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parseMode,
          disable_web_page_preview: options?.disablePreview ?? true,
          reply_markup: options?.replyMarkup,
        }),
      }
    );
    if (!res.ok) {
      console.error("[telegram] sendMessage failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] sendMessage error:", err);
    return false;
  }
}

const CABINET_URL = process.env.NEXT_PUBLIC_APP_URL;

/** Сообщение с кнопкой «Поделиться номером» (request_contact). */
export function sendContactRequest(chatId: string | number, text: string): Promise<boolean> {
  return sendTelegramMessage(chatId, text, {
    replyMarkup: {
      keyboard: [[{ text: "📱 Поделиться номером", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

/** Сообщение с кнопкой открытия кабинета как Telegram Mini App. */
export function sendCabinetButton(chatId: string | number, text: string): Promise<boolean> {
  if (!CABINET_URL) {
    return sendTelegramMessage(chatId, text);
  }
  return sendTelegramMessage(chatId, text, {
    replyMarkup: {
      inline_keyboard: [[{ text: "Открыть кабинет", web_app: { url: `${CABINET_URL}/entrance` } }]],
    },
  });
}
