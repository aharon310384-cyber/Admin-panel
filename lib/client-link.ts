import "server-only";

import type { Customer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { phonesMatch } from "@/lib/phone";

export type TelegramIdentity = {
  userId: string;
  chatId: string;
  username?: string | null;
};

/** Находит клиента по уже привязанному Telegram user id. */
export async function findCustomerByTelegramId(
  telegramUserId: string
): Promise<Customer | null> {
  return prisma.customer.findFirst({
    where: { telegramUserId, deletedAt: null, code: { not: null } },
  });
}

/**
 * Привязка по верифицированному номеру телефона (из Telegram-контакта).
 * Ищет клиента с совпадающим телефоном (последние 10 цифр), ещё не привязанного
 * к другому Telegram-аккаунту, и сохраняет Telegram-идентификаторы.
 * Возвращает привязанного клиента или null, если совпадения нет.
 */
export async function linkCustomerByPhone(
  phone: string,
  tg: TelegramIdentity
): Promise<Customer | null> {
  // Уже привязан этим Telegram — вернуть как есть
  const already = await findCustomerByTelegramId(tg.userId);
  if (already) return already;

  const candidates = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      code: { not: null },
      phone: { not: null },
      telegramUserId: null,
    },
    select: { id: true, phone: true },
  });

  const match = candidates.find((c) => phonesMatch(c.phone, phone));
  if (!match) return null;

  return prisma.customer.update({
    where: { id: match.id },
    data: {
      telegramUserId: tg.userId,
      telegramChatId: tg.chatId,
      telegramUsername: tg.username ?? null,
      telegramLinkedAt: new Date(),
    },
  });
}
