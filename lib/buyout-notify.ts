import "server-only";

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { getTelegramTexts } from "@/lib/company";
import { notifyOwner } from "@/lib/owner-notify";
import { clientBalance } from "@/lib/balance";
import { yuan } from "@/lib/buyout-money";
import { BUYOUT_KIND_LABELS } from "@/lib/statuses";

// Сообщения по выкупу и балансу. Клиенту — в Telegram (как у посылок), владельцу — notifyOwner.
// Ничего не бросают: сбой сообщения не ломает действие, которое его вызвало.

export type BuyoutEvent = "priced" | "paid" | "purchased" | "shipped" | "at-warehouse" | "rejected" | "refunded";

async function sendToClient(chatId: string, text: string) {
  const { signature } = await getTelegramTexts();
  await sendTelegramMessage(chatId, signature ? `${text}\n\n${signature}` : text);
}

const cabinetLink = () => (process.env.NEXT_PUBLIC_APP_URL ? `\n${process.env.NEXT_PUBLIC_APP_URL}/cabinet/buyouts` : "");

/** Сообщить клиенту о событии выкупа. */
export async function notifyBuyoutClient(buyoutId: string, event: BuyoutEvent): Promise<void> {
  try {
    const b = await prisma.buyout.findUnique({
      where: { id: buyoutId },
      include: { customer: { select: { id: true, telegramChatId: true } } },
    });
    const chatId = b?.customer.telegramChatId;
    if (!b || !chatId) return;
    const head = `🛒 Выкуп ${b.number} — ${b.productName}`;
    let text: string;
    switch (event) {
      case "priced":
        text = [
          head,
          `Цена: ${yuan(b.totalCny)}`,
          `товар ${yuan(b.goodsCny)} · доставка по Китаю ${yuan(b.chinaDeliveryCny)} · комиссия ${yuan(b.commissionCny)}`,
          `Оплатите с баланса в кабинете.${cabinetLink()}`,
        ].join("\n");
        break;
      case "paid":
        text = `${head}\n💳 Списано с баланса: ${yuan(b.totalCny)}. Остаток: ${yuan(await clientBalance(b.customer.id))}.\nПокупаем у продавца.`;
        break;
      case "purchased":
        text = `${head}\n✅ Выкуплено. Ждём, когда продавец отправит товар на склад.`;
        break;
      case "shipped":
        text = `${head}\n🚚 Продавец отправил товар на склад${b.sellerTrack ? `, трек ${b.sellerTrack}` : ""}.`;
        break;
      case "at-warehouse":
        text = `${head}\n📦 Товар на складе. Дальше — как обычный заказ: оформите посылку в кабинете.`;
        break;
      case "rejected":
        text = [
          head,
          `❌ Отказ${b.rejectReason ? `: ${b.rejectReason}` : ""}.`,
          b.refundCny != null && Number(b.refundCny) > 0
            ? `Возвращено на баланс: ${yuan(b.refundCny)}. Баланс: ${yuan(await clientBalance(b.customer.id))}.`
            : null,
        ]
          .filter(Boolean)
          .join("\n");
        break;
      case "refunded":
        text = `${head}\n↩️ Возврат: на баланс ${yuan(b.refundCny)}. Баланс: ${yuan(await clientBalance(b.customer.id))}.`;
        break;
    }
    await sendToClient(chatId, text);
  } catch (error) {
    console.error("[buyout-notify] client:", error);
  }
}

/** Сообщить клиенту о зачислении, отказе в пополнении или сторно зачисления. */
export async function notifyTopUpClient(requestId: string, event: "credited" | "canceled" | "storno"): Promise<void> {
  try {
    const r = await prisma.topUpRequest.findUnique({
      where: { id: requestId },
      include: { customer: { select: { id: true, telegramChatId: true } } },
    });
    const chatId = r?.customer.telegramChatId;
    if (!r || !chatId) return;
    const text =
      event === "credited"
        ? `💰 Зачислено на баланс: ${yuan(r.amount)} (заявка ${r.number}). Баланс: ${yuan(await clientBalance(r.customer.id))}.`
        : event === "storno"
          ? `Зачисление ${yuan(r.amount)} по заявке ${r.number} отменено${r.cancelReason ? ` (${r.cancelReason})` : ""}. Баланс: ${yuan(await clientBalance(r.customer.id))}.`
          : `Заявка на пополнение ${r.number} на ${yuan(r.amount)} отклонена${r.cancelReason ? `: ${r.cancelReason}` : ""}.`;
    await sendToClient(chatId, text);
  } catch (error) {
    console.error("[buyout-notify] top-up:", error);
  }
}

const adminLink = (path: string) => (process.env.NEXT_PUBLIC_APP_URL ? `\n${process.env.NEXT_PUBLIC_APP_URL}${path}` : "");

/** Оповещение владельцу не должно ломать действие: ошибка — только в журнал сервера. */
async function safely(work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    console.error("[buyout-notify] owner:", error);
  }
}

/** Владельцу: новая заявка на выкуп. */
export const notifyOwnerNewBuyout = (buyoutId: string) => safely(() => ownerNewBuyout(buyoutId));
export const notifyOwnerBuyoutPaid = (buyoutId: string) => safely(() => ownerBuyoutPaid(buyoutId));
export const notifyOwnerTopUp = (requestId: string) => safely(() => ownerTopUp(requestId));

async function ownerNewBuyout(buyoutId: string): Promise<void> {
  const b = await prisma.buyout.findUnique({
    where: { id: buyoutId },
    include: { customer: { select: { code: true, name: true } } },
  });
  if (!b) return;
  await notifyOwner(
    [
      `🛒 Новая заявка на выкуп ${b.number}`,
      `${b.customer.code ?? ""} ${b.customer.name}`.trim(),
      `${BUYOUT_KIND_LABELS[b.kind]}: ${b.productName}${b.variant ? ` (${b.variant})` : ""} × ${b.quantity}`,
      b.url ?? b.sellerContact ?? null,
    ]
      .filter(Boolean)
      .join("\n") + adminLink(`/buyouts/${b.id}`)
  );
}

/** Владельцу: клиент оплатил выкуп — пора покупать. */
async function ownerBuyoutPaid(buyoutId: string): Promise<void> {
  const b = await prisma.buyout.findUnique({
    where: { id: buyoutId },
    include: { customer: { select: { code: true, name: true } } },
  });
  if (!b) return;
  await notifyOwner(
    `💳 Клиент оплатил выкуп ${b.number}: ${yuan(b.totalCny)}\n${`${b.customer.code ?? ""} ${b.customer.name}`.trim()} · ${b.productName} × ${b.quantity}\nМожно покупать.` +
      adminLink(`/buyouts/${b.id}`)
  );
}

/** Владельцу: новая заявка на пополнение баланса — проверить оплату и зачислить. */
async function ownerTopUp(requestId: string): Promise<void> {
  const r = await prisma.topUpRequest.findUnique({
    where: { id: requestId },
    include: { customer: { select: { code: true, name: true } } },
  });
  if (!r) return;
  await notifyOwner(
    `💰 Заявка на пополнение ${r.number}: ${yuan(r.amount)}${r.method ? ` · ${r.method}` : ""}\n${`${r.customer.code ?? ""} ${r.customer.name}`.trim()}${r.reference ? `\nНомер платежа: ${r.reference}` : ""}\nПроверьте оплату и нажмите «Зачислить».` +
      adminLink(`/top-ups/${r.id}`)
  );
}
