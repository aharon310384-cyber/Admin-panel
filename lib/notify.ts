import "server-only";

import type { ParcelStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientParcelNumber } from "@/lib/parcel-number";
import { sendTelegramMessage } from "@/lib/telegram";
import { parcelStatusLabel } from "@/lib/statuses";
import { getTelegramTexts } from "@/lib/company";

/**
 * Уведомления клиенту в Telegram о событиях по посылке.
 * Безопасны: при отсутствии токена/привязанного chatId или любой ошибке —
 * тихо ничего не делают и НЕ ломают вызывающее серверное действие.
 */

/** Отправить уведомление с подписью компании из её настроек (если подпись задана). */
async function sendNotice(chatId: string, text: string): Promise<void> {
  const { signature } = await getTelegramTexts();
  await sendTelegramMessage(chatId, signature ? `${text}\n\n${signature}` : text);
}

/** Сообщить клиенту о смене статуса посылки. */
export async function notifyParcelStatusChange(
  parcelId: string,
  status: ParcelStatus
): Promise<void> {
  try {
    const parcel = await prisma.parcel.findUnique({
      where: { id: parcelId },
      select: { number: true, parcelTask: { select: { number: true } }, customer: { select: { telegramChatId: true } } },
    });
    const chatId = parcel?.customer?.telegramChatId;
    if (!chatId) return;
    await sendNotice(
      chatId,
      `📦 Посылка ${clientParcelNumber(parcel!)}\nСтатус изменён: ${parcelStatusLabel(status)}`
    );
  } catch (err) {
    console.error("[notify] parcel status change:", err);
  }
}

/** Сообщить клиенту, что посылка отмечена оплаченной. */
export async function notifyParcelPaid(parcelId: string): Promise<void> {
  try {
    const parcel = await prisma.parcel.findUnique({
      where: { id: parcelId },
      select: { number: true, parcelTask: { select: { number: true } }, customer: { select: { telegramChatId: true } } },
    });
    const chatId = parcel?.customer?.telegramChatId;
    if (!chatId) return;
    await sendNotice(
      chatId,
      `✅ Посылка ${clientParcelNumber(parcel!)} отмечена как оплаченная. Спасибо!`
    );
  } catch (err) {
    console.error("[notify] parcel paid:", err);
  }
}
