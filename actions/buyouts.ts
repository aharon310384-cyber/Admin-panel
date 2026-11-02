"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { BuyoutStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { getFinanceSettings } from "@/lib/finance";
import { addLedgerEntry, lockClientMoney } from "@/lib/balance";
import { buyoutTotals, commissionFor, parseMoney, round2, yuan } from "@/lib/buyout-money";
import { COMMISSION_MISSING, PAID_STATUSES, getBuyoutSettings } from "@/lib/buyouts";
import { createOrderFromBuyout, publicPhotoUrl } from "@/lib/buyout-order";
import { notifyBuyoutClient } from "@/lib/buyout-notify";
import { ensureBaseline, recordVersion } from "@/lib/versions";

// Действия менеджера с выкупом (карточка /buyouts/[id]). Каждое — проверка статуса в той же транзакции, где он
// меняется (updateMany по старому статусу): двойное нажатие или два сотрудника сразу не проведут шаг дважды.

export type BuyoutActionResult = { ok: true; message?: string } | { ok: false; error: string };

const text = (value: FormDataEntryValue | null, max = 500) => (typeof value === "string" ? value.trim().slice(0, max) : "");

class StepError extends Error {}

const REJECTABLE: BuyoutStatus[] = ["NEW", "PRICED", "PAID", "PURCHASED"];
const RETURNABLE: BuyoutStatus[] = ["PURCHASED", "SHIPPED", "AT_WAREHOUSE"];

/** Сменить статус, только если выкуп ещё в одном из ожидаемых; иначе — понятная ошибка, ничего не записано. */
async function moveStatus(
  tx: Prisma.TransactionClient,
  id: string,
  from: BuyoutStatus[],
  to: BuyoutStatus,
  data: Prisma.BuyoutUpdateManyMutationInput,
  history: { changedById: string; note?: string | null }
) {
  const updated = await tx.buyout.updateMany({ where: { id, status: { in: from }, deletedAt: null }, data: { ...data, status: to } });
  if (!updated.count) throw new StepError("Выкуп уже изменили — обновите страницу");
  await tx.buyoutStatusHistory.create({ data: { buyoutId: id, status: to, changedById: history.changedById, note: history.note ?? null } });
}

async function run(id: string, work: () => Promise<string | void>): Promise<BuyoutActionResult> {
  try {
    const message = await work();
    revalidatePath("/buyouts");
    revalidatePath(`/buyouts/${id}`);
    revalidatePath("/cabinet/buyouts");
    return { ok: true, message: message || undefined };
  } catch (error) {
    if (error instanceof StepError) return { ok: false, error: error.message };
    console.error("[buyouts]", error);
    return { ok: false, error: "Не получилось — попробуйте ещё раз" };
  }
}

/** «Назначить цену»: цена за штуку, количество, доставка по Китаю; комиссия — по настройкам или вручную. */
export async function setBuyoutPrice(id: string, formData: FormData): Promise<BuyoutActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const unitPriceCny = parseMoney(formData.get("unitPriceCny"));
    const quantity = Number(formData.get("quantity"));
    const chinaDeliveryCny = parseMoney(formData.get("chinaDeliveryCny")) ?? 0;
    const manual = formData.get("commissionManual") === "on";
    const productName = text(formData.get("productName"), 200);
    const variant = text(formData.get("variant"), 200);
    if (unitPriceCny == null || unitPriceCny <= 0) throw new StepError("Укажите цену товара за штуку");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) throw new StepError("Количество — целое число от 1");
    if (chinaDeliveryCny < 0) throw new StepError("Доставка по Китаю не может быть меньше нуля");
    if (!productName) throw new StepError("Укажите название товара");

    const settings = await getBuyoutSettings();
    const goodsCny = round2(unitPriceCny * quantity);
    const auto = commissionFor(goodsCny, { percent: settings.commissionPercent, minCny: settings.commissionMinCny });
    const commissionCny = manual ? parseMoney(formData.get("commissionCny")) : auto;
    if (commissionCny == null) throw new StepError(manual ? "Укажите комиссию" : COMMISSION_MISSING);
    if (commissionCny < 0) throw new StepError("Комиссия не может быть меньше нуля");
    const totals = buyoutTotals({ unitPriceCny, quantity, chinaDeliveryCny, commissionCny });

    await prisma.$transaction(async (tx) => {
      const current = await tx.buyout.findUnique({ where: { id }, select: { status: true } });
      await moveStatus(
        tx,
        id,
        ["NEW", "PRICED"],
        "PRICED",
        {
          productName,
          variant: variant || null,
          quantity,
          unitPriceCny,
          goodsCny: totals.goodsCny,
          chinaDeliveryCny,
          commissionPercent: settings.commissionPercent,
          commissionCny,
          commissionManual: manual,
          totalCny: totals.totalCny,
          pricedAt: new Date(),
        },
        {
          changedById: session.user.id,
          note: `${current?.status === "PRICED" ? "Цена изменена" : "Цена назначена"}: ${yuan(totals.totalCny)}${manual ? " (комиссия вручную)" : ""}`,
        }
      );
    });
    after(() => notifyBuyoutClient(id, "priced"));
    return `Цена ${yuan(totals.totalCny)} — клиенту отправлено сообщение`;
  });
}

/** «Выкуплено»: сотрудник купил у продавца; сколько фактически заплачено продавцу — для учёта нашей разницы. */
export async function markBuyoutPurchased(id: string, formData: FormData): Promise<BuyoutActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const paidToSellerCny = parseMoney(formData.get("paidToSellerCny"));
    if (paidToSellerCny != null && paidToSellerCny < 0) throw new StepError("Сумма продавцу не может быть меньше нуля");
    await prisma.$transaction((tx) =>
      moveStatus(
        tx,
        id,
        ["PAID"],
        "PURCHASED",
        { purchasedAt: new Date(), ...(paidToSellerCny != null ? { paidToSellerCny } : {}) },
        { changedById: session.user.id, note: paidToSellerCny != null ? `Заплачено продавцу ${yuan(paidToSellerCny)}` : null }
      )
    );
    after(() => notifyBuyoutClient(id, "purchased"));
  });
}

/**
 * «Вписать трек»: трек продавца. Первый раз — статус «Отправлена продавцом» и заказ ZK-… (раздел 4 задания).
 * Потом — исправить трек: в заказе он меняется, пока склад заказ не принял.
 */
export async function setBuyoutTrack(id: string, formData: FormData): Promise<BuyoutActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const track = text(formData.get("sellerTrack"), 80).replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z0-9-]{4,80}$/.test(track)) throw new StepError("Трек-номер — латиница и цифры, от 4 знаков");
    const buyout = await prisma.buyout.findUnique({ where: { id }, select: { status: true, number: true, orderId: true } });
    if (!buyout) throw new StepError("Выкуп не найден");

    if (buyout.status === "PURCHASED") {
      const { exchangeRateCnyPerUsd } = await getFinanceSettings();
      const orderNumber = await prisma.$transaction(async (tx) => {
        await moveStatus(tx, id, ["PURCHASED"], "SHIPPED", { sellerTrack: track, shippedAt: new Date() }, {
          changedById: session.user.id,
          note: `Трек продавца ${track}`,
        });
        const fresh = await tx.buyout.findUniqueOrThrow({ where: { id } });
        if (fresh.orderId) return null;
        const order = await createOrderFromBuyout(tx, fresh, { authorId: session.user.id, rateCnyPerUsd: exchangeRateCnyPerUsd });
        await tx.buyout.update({ where: { id }, data: { orderId: order.id } });
        await tx.buyoutStatusHistory.create({
          data: { buyoutId: id, status: "SHIPPED", changedById: session.user.id, note: `Создан заказ ${order.number}` },
        });
        return order.number;
      });
      after(() => notifyBuyoutClient(id, "shipped"));
      return orderNumber ? `Создан заказ ${orderNumber}` : undefined;
    }

    if (buyout.status !== "SHIPPED") throw new StepError("Трек вписывают после «Выкуплено»");
    const order = buyout.orderId
      ? await prisma.order.findUnique({ where: { id: buyout.orderId }, select: { id: true, status: true } })
      : null;
    if (order && !["NEW", "IN_RECEIVING_QUEUE"].includes(order.status)) throw new StepError("Склад уже принял заказ — трек не меняется");
    if (order) await ensureBaseline("order", order.id);
    await prisma.$transaction(async (tx) => {
      await moveStatus(tx, id, ["SHIPPED"], "SHIPPED", { sellerTrack: track }, { changedById: session.user.id, note: `Трек исправлен: ${track}` });
      if (order) {
        await tx.order.update({ where: { id: order.id }, data: { trackNumber: track } });
        await recordVersion("order", order.id, { authorId: session.user.id, comment: `Трек из выкупа ${buyout.number}` }, tx);
      }
    });
    return "Трек исправлен";
  });
}

/** «Отказать (причина)». Если клиент уже заплатил — деньги обратной записью на баланс. */
export async function rejectBuyout(id: string, formData: FormData): Promise<BuyoutActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const picked = text(formData.get("reason"), 200);
    const other = text(formData.get("reasonOther"), 300);
    const reason = [picked, other].filter(Boolean).join(": ");
    if (!reason) throw new StepError("Укажите причину отказа");
    await prisma.$transaction(async (tx) => {
      // Сначала деньги клиента, потом чтение выкупа: оплата в ту же секунду ждёт, и отказ видит её (иначе — без возврата)
      const owner = await tx.buyout.findUnique({ where: { id }, select: { customerId: true } });
      if (!owner) throw new StepError("Выкуп не найден");
      await lockClientMoney(tx, owner.customerId);
      const buyout = await tx.buyout.findUniqueOrThrow({ where: { id } });
      if (buyout.orderId) throw new StepError("Заказ уже создан — оформите «Возврат»");
      if (!REJECTABLE.includes(buyout.status)) throw new StepError("Выкуп уже закрыт — обновите страницу");
      const paid = PAID_STATUSES.includes(buyout.status) && buyout.totalCny != null ? Number(buyout.totalCny) : 0;
      await moveStatus(tx, id, [buyout.status], "REJECTED", { rejectReason: reason, refundCny: paid > 0 ? paid : null }, {
        changedById: session.user.id,
        note: `Отказ: ${reason}${paid > 0 ? ` · возвращено ${yuan(paid)}` : ""}`,
      });
      if (paid > 0) {
        await addLedgerEntry(tx, {
          customerId: buyout.customerId,
          amount: -paid,
          reason: "BUYOUT_REFUND",
          note: `Отказ по выкупу ${buyout.number}: ${reason}`,
          createdById: session.user.id,
          buyoutId: id,
        });
      }
    });
    after(() => notifyBuyoutClient(id, "rejected"));
  });
}

/**
 * «Возврат»: брак или не тот товар — за счёт продавца (клиенту всё назад); клиент передумал — за его счёт
 * (доставка продавцу и комиссия не возвращаются). Сумма на баланс — подсказка программы, менеджер может поправить.
 * Заказ из выкупа, если склад его ещё не оформил в посылку, получает статус «Возвращён».
 */
export async function returnBuyout(id: string, formData: FormData): Promise<BuyoutActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const kind = formData.get("returnKind") === "CLIENT" ? "CLIENT" : formData.get("returnKind") === "SELLER" ? "SELLER" : null;
    const returnCostCny = parseMoney(formData.get("returnCostCny")) ?? 0;
    const refundCny = parseMoney(formData.get("refundCny"));
    const note = text(formData.get("note"), 300);
    if (!kind) throw new StepError("Выберите, за чей счёт возврат");
    if (returnCostCny < 0) throw new StepError("Расходы не могут быть меньше нуля");
    if (refundCny == null || refundCny < 0) throw new StepError("Укажите сумму на баланс клиента (0 — ничего)");

    await prisma.$transaction(async (tx) => {
      const owner = await tx.buyout.findUnique({ where: { id }, select: { customerId: true } });
      if (!owner) throw new StepError("Выкуп не найден");
      await lockClientMoney(tx, owner.customerId);
      const buyout = await tx.buyout.findUniqueOrThrow({ where: { id }, include: { order: { select: { id: true, status: true, number: true } } } });
      if (!RETURNABLE.includes(buyout.status)) throw new StepError("Возврат — после «Выкуплено»; обновите страницу");
      const paid = buyout.totalCny != null ? Number(buyout.totalCny) : 0;
      if (refundCny > paid) throw new StepError(`Вернуть можно не больше, чем клиент заплатил: ${yuan(paid)}`);
      const order = buyout.order;
      if (order?.status === "FORMED") throw new StepError(`Заказ ${order.number} уже в посылке — сначала уберите его из посылки`);
      const orderReturns = order && !["RETURNED", "UTILIZED"].includes(order.status);
      if (orderReturns) await ensureBaseline("order", order.id, tx);

      await moveStatus(tx, id, [buyout.status], "RETURNED", { returnKind: kind, returnCostCny, refundCny }, {
        changedById: session.user.id,
        note: [kind === "SELLER" ? "Возврат за счёт продавца" : "Возврат за счёт клиента", `на баланс ${yuan(refundCny)}`, note].filter(Boolean).join(" · "),
      });
      if (refundCny > 0) {
        await addLedgerEntry(tx, {
          customerId: buyout.customerId,
          amount: -refundCny,
          reason: "BUYOUT_REFUND",
          note: `Возврат по выкупу ${buyout.number}${note ? `: ${note}` : ""}`,
          createdById: session.user.id,
          buyoutId: id,
        });
      }
      if (orderReturns) {
        await tx.order.update({ where: { id: order.id }, data: { status: "RETURNED" } });
        await tx.orderStatusHistory.create({
          data: { orderId: order.id, status: "RETURNED", changedBy: session.user.id, note: `Возврат по выкупу ${buyout.number}` },
        });
        await recordVersion("order", order.id, { authorId: session.user.id, comment: `Возврат по выкупу ${buyout.number}` }, tx);
      }
    });
    after(() => notifyBuyoutClient(id, "refunded"));
  });
}

/** Учёт: внутренний комментарий, сколько заплачено продавцу, фото товара (переходит в заказ). */
export async function updateBuyoutNotes(id: string, formData: FormData): Promise<BuyoutActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const paidToSellerCny = parseMoney(formData.get("paidToSellerCny"));
    if (paidToSellerCny != null && paidToSellerCny < 0) throw new StepError("Сумма продавцу не может быть меньше нуля");
    const rawPhoto = text(formData.get("photoUrl"), 300);
    const photoUrl = rawPhoto ? publicPhotoUrl(rawPhoto) : null;
    if (rawPhoto && !photoUrl) throw new StepError("Фото — картинка, загруженная кнопкой «Загрузить»");
    const before = await prisma.buyout.findUnique({ where: { id }, select: { paidToSellerCny: true, deletedAt: true } });
    if (!before || before.deletedAt) throw new StepError("Выкуп не найден");
    await prisma.buyout.update({
      where: { id },
      data: { internalComment: text(formData.get("internalComment"), 2000) || null, paidToSellerCny, photoUrl },
    });
    const was = before.paidToSellerCny != null ? Number(before.paidToSellerCny) : null;
    if (was !== paidToSellerCny) {
      const current = await prisma.buyout.findUniqueOrThrow({ where: { id }, select: { status: true } });
      await prisma.buyoutStatusHistory.create({
        data: { buyoutId: id, status: current.status, changedById: session.user.id, note: `Заплачено продавцу: ${yuan(paidToSellerCny)}` },
      });
    }
    return "Сохранено";
  });
}

/** Пометить на удаление (или снять пометку): только пока у выкупа нет денег клиента. */
export async function setBuyoutDeleted(id: string, deleted: boolean): Promise<BuyoutActionResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const buyout = await prisma.buyout.findUnique({ where: { id }, select: { status: true } });
    if (!buyout) throw new StepError("Выкуп не найден");
    if (!["NEW", "PRICED", "REJECTED", "CANCELED"].includes(buyout.status)) {
      throw new StepError("Удалить можно новую, неоплаченную, отклонённую или отменённую заявку");
    }
    await prisma.$transaction([
      prisma.buyout.update({ where: { id }, data: { deletedAt: deleted ? new Date() : null } }),
      prisma.buyoutStatusHistory.create({
        data: { buyoutId: id, status: buyout.status, changedById: session.user.id, note: deleted ? "Помечен на удаление" : "Пометка удаления снята" },
      }),
    ]);
  });
}
