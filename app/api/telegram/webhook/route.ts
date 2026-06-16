import { NextResponse } from "next/server";
import {
  sendContactRequest,
  sendCabinetButton,
  sendTelegramMessage,
} from "@/lib/telegram";
import { linkCustomerByPhone } from "@/lib/client-link";

/**
 * Webhook Telegram-бота.
 * - /start → просим поделиться номером (request_contact)
 * - контакт → привязываем клиента по телефону и даём кнопку входа в кабинет
 *
 * Защита: если задан TELEGRAM_WEBHOOK_SECRET, проверяем заголовок
 * X-Telegram-Bot-Api-Secret-Token (устанавливается при setWebhook).
 */

type TgUser = { id: number; username?: string };
type TgContact = { phone_number: string; user_id?: number };
type TgMessage = {
  text?: string;
  chat?: { id: number };
  from?: TgUser;
  contact?: TgContact;
};
type TgUpdate = { message?: TgMessage };

const MANAGER_HINT =
  "Мы не нашли вас по этому номеру. Возможно, в вашей карточке указан другой телефон — напишите менеджеру, и мы привяжем аккаунт вручную.";

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  if (!msg || chatId === undefined) {
    return NextResponse.json({ ok: true });
  }

  // Клиент поделился контактом → привязка
  if (msg.contact && msg.from) {
    const phone = msg.contact.phone_number;
    const linked = await linkCustomerByPhone(phone, {
      userId: String(msg.from.id),
      chatId: String(chatId),
      username: msg.from.username ?? null,
    });

    if (linked) {
      await sendCabinetButton(
        chatId,
        "✅ Номер подтверждён, аккаунт привязан. Откройте кабинет."
      );
    } else {
      await sendTelegramMessage(chatId, MANAGER_HINT);
    }
    return NextResponse.json({ ok: true });
  }

  // /start или любой текст → просим номер
  if (msg.text) {
    await sendContactRequest(
      chatId,
      "Здравствуйте! 🦊 Это кабинет PostmanFox.\n\nЧтобы войти, подтвердите номер телефона — нажмите кнопку ниже."
    );
  }

  return NextResponse.json({ ok: true });
}
