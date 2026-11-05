import "server-only";

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { getTelegramTexts } from "@/lib/company";
import { notifyOwner } from "@/lib/owner-notify";
import { clientBalance } from "@/lib/balance";
import { yuan } from "@/lib/purchase-money";
import { PURCHASE_MODE_LABELS } from "@/lib/statuses";

// Сообщения по покупке и балансу. Клиенту — в Telegram (как у посылок), владельцу — notifyOwner.
// Ничего не бросают: сбой сообщения не ломает действие, которое его вызвало.

export type PurchaseEvent = "priced" | "surcharge" | "paid" | "purchased" | "shipped-by-seller" | "at-warehouse" | "shipped" | "rejected" | "refunded" | "returned";

async function sendToClient(chatId: string, text: string) {
  const { signature } = await getTelegramTexts();
  await sendTelegramMessage(chatId, signature ? `${text}\n\n${signature}` : text);
}

const appLink = (path: string) => (process.env.NEXT_PUBLIC_APP_URL ? `\n${process.env.NEXT_PUBLIC_APP_URL}${path}` : "");

async function paidNet(purchaseId: string) {
  const sum = await prisma.clientLedger.aggregate({
    where: { purchaseId, deletedAt: null, reason: { in: ["PURCHASE_PAYMENT", "PURCHASE_REFUND"] } },
    _sum: { amount: true },
  });
  return Number(sum._sum.amount ?? 0);
}

/** Сообщить клиенту о событии покупки. */
export async function notifyPurchaseClient(purchaseId: string, event: PurchaseEvent): Promise<void> {
  try {
    const p = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        customer: { select: { id: true, telegramChatId: true } },
        lines: { orderBy: { lineNo: "asc" }, select: { lineNo: true, productName: true, status: true, sellerTrack: true, rejectReason: true } },
      },
    });
    const chatId = p?.customer.telegramChatId;
    if (!p || !chatId) return;
    const names = p.lines.filter((l) => l.status !== "REJECTED").map((l) => l.productName);
    const head = `🛒 Покупка ${p.number}${names.length ? ` — ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` и ещё ${names.length - 3}` : ""}` : ""}`;
    const balance = async () => yuan(await clientBalance(p.customer.id));
    let text: string | null = null;
    switch (event) {
      case "priced":
        text = [
          head,
          `К оплате: ${yuan(p.totalCny)} — товар ${yuan(p.goodsCny)} · доставка по Китаю ${yuan(p.chinaDeliveryCny)} · комиссия ${yuan(p.commissionCny)}`,
          p.mode === "TURNKEY"
            ? `Доставка за границу — после взвешивания посылки${p.shippingEstimateCny != null ? `, ориентировочно ${yuan(p.shippingEstimateCny)}` : ""}.`
            : null,
          `Оплатите с баланса в кабинете.${appLink("/cabinet/purchases")}`,
        ]
          .filter(Boolean)
          .join("\n");
        break;
      case "surcharge": {
        const due = Number(p.totalCny ?? 0) - (await paidNet(purchaseId));
        if (due > 0) text = `${head}\nЦена изменилась: нужно доплатить ${yuan(due)}. Оплатите с баланса в кабинете.${appLink("/cabinet/purchases")}`;
        break;
      }
      case "paid":
        text = `${head}\n💳 Списано с баланса. Оплачено: ${yuan(await paidNet(purchaseId))}. Баланс: ${await balance()}.\nПокупаем у продавцов.`;
        break;
      case "purchased":
        text = `${head}\n✅ Всё выкуплено. Ждём, когда продавцы отправят товар на склад.`;
        break;
      case "shipped-by-seller":
        text = `${head}\n🚚 Продавец отправил товар на склад${p.lines.find((l) => l.status === "SHIPPED" && l.sellerTrack)?.sellerTrack ? ` (трек ${p.lines.find((l) => l.status === "SHIPPED")!.sellerTrack})` : ""}.`;
        break;
      case "at-warehouse":
        text = `${head}\n📦 Все товары на складе.${p.mode === "TURNKEY" ? " Собираем посылку — пришлём вес и цену доставки." : " Дальше — как обычный заказ: оформите посылку в кабинете."}`;
        break;
      case "shipped":
        text = `${head}\n✈️ Посылка оформлена.`;
        break;
      case "rejected":
        text = [head, `❌ Отказ${p.rejectReason ? `: ${p.rejectReason}` : ""}.`, p.paidAt ? `Деньги возвращены на баланс. Баланс: ${await balance()}.` : null].filter(Boolean).join("\n");
        break;
      case "refunded":
        text = `${head}\n↩️ Разница возвращена на баланс. Баланс: ${await balance()}.`;
        break;
      case "returned":
        text = `${head}\n↩️ Возврат товара оформлен, деньги — на баланс. Баланс: ${await balance()}.`;
        break;
    }
    if (text) await sendToClient(chatId, text);
  } catch (error) {
    console.error("[purchase-notify] client:", error);
  }
}

/** Сообщить клиенту об отказе по одной строке (остальные покупаем). */
export async function notifyLineRejected(purchaseId: string, lineNo: number): Promise<void> {
  try {
    const p = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { customer: { select: { telegramChatId: true } }, lines: { where: { lineNo } } },
    });
    const line = p?.lines[0];
    if (!p?.customer.telegramChatId || !line) return;
    await sendToClient(
      p.customer.telegramChatId,
      `🛒 Покупка ${p.number}\n❌ Товар «${line.productName}» купить не сможем${line.rejectReason ? `: ${line.rejectReason}` : ""}.${p.paidAt ? " Его стоимость вернётся на баланс." : ""}`
    );
  } catch (error) {
    console.error("[purchase-notify] line:", error);
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
    console.error("[purchase-notify] top-up:", error);
  }
}

/** Оповещение владельцу не должно ломать действие: ошибка — только в журнал сервера. */
async function safely(work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    console.error("[purchase-notify] owner:", error);
  }
}

export const notifyOwnerNewPurchase = (purchaseId: string) => safely(() => ownerNewPurchase(purchaseId));
export const notifyOwnerPurchasePaid = (purchaseId: string, amount: number) => safely(() => ownerPurchasePaid(purchaseId, amount));
export const notifyOwnerTopUp = (requestId: string) => safely(() => ownerTopUp(requestId));

async function ownerNewPurchase(purchaseId: string): Promise<void> {
  const p = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { customer: { select: { code: true, name: true } }, lines: { orderBy: { lineNo: "asc" } } },
  });
  if (!p) return;
  const country = p.countryCode ? await prisma.country.findUnique({ where: { code: p.countryCode }, select: { nameRu: true } }) : null;
  await notifyOwner(
    [
      `🛒 Новая покупка ${p.number} · ${PURCHASE_MODE_LABELS[p.mode]}${country ? ` · ${country.nameRu}` : ""}`,
      `${p.customer.code ?? ""} ${p.customer.name}`.trim(),
      ...p.lines.slice(0, 5).map((l) => `• ${l.productName}${l.variant ? ` (${l.variant})` : ""} × ${l.quantity}${l.url ? ` — ${l.url}` : l.sellerContact ? ` — ${l.sellerContact}` : ""}`),
      p.lines.length > 5 ? `…и ещё ${p.lines.length - 5}` : null,
    ]
      .filter(Boolean)
      .join("\n") + appLink(`/purchases/${p.id}`)
  );
}

async function ownerPurchasePaid(purchaseId: string, amount: number): Promise<void> {
  const p = await prisma.purchase.findUnique({ where: { id: purchaseId }, include: { customer: { select: { code: true, name: true } }, _count: { select: { lines: true } } } });
  if (!p) return;
  await notifyOwner(
    `💳 Клиент оплатил покупку ${p.number}: ${yuan(amount)}\n${`${p.customer.code ?? ""} ${p.customer.name}`.trim()} · товаров: ${p._count.lines}\nМожно покупать.` +
      appLink(`/purchases/${p.id}`)
  );
}

async function ownerTopUp(requestId: string): Promise<void> {
  const r = await prisma.topUpRequest.findUnique({ where: { id: requestId }, include: { customer: { select: { code: true, name: true } } } });
  if (!r) return;
  await notifyOwner(
    `💰 Заявка на пополнение ${r.number}: ${yuan(r.amount)}${r.method ? ` · ${r.method}` : ""}\n${`${r.customer.code ?? ""} ${r.customer.name}`.trim()}${r.reference ? `\nНомер платежа: ${r.reference}` : ""}\nПроверьте оплату и нажмите «Зачислить».` +
      appLink(`/top-ups/${r.id}`)
  );
}
