import "server-only";

import type { ParcelStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { parcelStatusLabel } from "@/lib/statuses";

/**
 * Уведомления клиенту в Telegram о событиях по посылке.
 * Безопасны: при отсутствии токена/привязанного chatId или любой ошибке —
 * тихо ничего не делают и НЕ ломают вызывающее серверное действие.
 */

/** Сообщить клиенту о смене статуса посылки. */
export async function notifyParcelStatusChange(
  parcelId: string,
  status: ParcelStatus
): Promise<void> {
  try {
    const parcel = await prisma.parcel.findUnique({
      where: { id: parcelId },
      select: { number: true, customer: { select: { telegramChatId: true } } },
    });
    const chatId = parcel?.customer?.telegramChatId;
    if (!chatId) return;
    await sendTelegramMessage(
      chatId,
      `📦 Посылка ${parcel!.number}\nСтатус изменён: ${parcelStatusLabel(status)}`
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
      select: { number: true, customer: { select: { telegramChatId: true } } },
    });
    const chatId = parcel?.customer?.telegramChatId;
    if (!chatId) return;
    await sendTelegramMessage(
      chatId,
      `✅ Посылка ${parcel!.number} отмечена как оплаченная. Спасибо!`
    );
  } catch (err) {
    console.error("[notify] parcel paid:", err);
  }
}
