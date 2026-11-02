"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { nextDocumentNumber } from "@/lib/document-numbers";
import { addLedgerEntry, clientBalance, lockClientMoney, paymentReference } from "@/lib/balance";
import { parseMoney, round2, yuan } from "@/lib/buyout-money";
import { attachmentsFromForm, ownBuyoutFileUrl } from "@/lib/buyout-files";
import { getBuyoutSettings } from "@/lib/buyouts";
import { notifyBuyoutClient, notifyOwnerBuyoutPaid, notifyOwnerNewBuyout, notifyOwnerTopUp } from "@/lib/buyout-notify";

// Действия клиента в кабинете: заявка на выкуп, оплата с баланса, отмена, заявка на пополнение.
// Клиент видит и меняет только свои выкупы: id клиента — из его сессии, не из формы.
// В режиме «просмотр кабинета» действует сотрудник за клиента — он и пишется автором.

export type CabinetResult = { ok: true; message?: string } | { ok: false; error: string; shortBy?: number };

const text = (value: FormDataEntryValue | null, max = 500) => (typeof value === "string" ? value.trim().slice(0, max) : "");

async function actor() {
  const { client, mode, session } = await getClientCabinetContext();
  return { customerId: client.id, staffId: mode === "admin" ? session?.user.id ?? null : null };
}

/** Первая ссылка из текста: Taobao и 1688 при «Поделиться» дают текст со ссылкой внутри. */
function firstLink(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s<>"'，。）)】]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
}

/** Новая заявка на выкуп: по ссылке или по контакту продавца (скриншот, QR, WeChat). */
export async function createBuyoutRequest(formData: FormData): Promise<CabinetResult> {
  const { customerId, staffId } = await actor();
  const kind = formData.get("kind") === "CONTACT" ? "CONTACT" : "LINK";
  const productName = text(formData.get("productName"), 200);
  const variant = text(formData.get("variant"), 200);
  const comment = text(formData.get("customerComment"), 1000);
  const quantity = Number(formData.get("quantity") || 1);
  const attachments = attachmentsFromForm(formData.get("attachments"), customerId);
  const rawLink = text(formData.get("url"), 3000);
  const url = rawLink ? firstLink(rawLink) : null;
  const sellerContact = text(formData.get("sellerContact"), 300);

  if (kind === "LINK" && !url) return { ok: false, error: "Вставьте ссылку на товар (начинается с http)" };
  if (kind === "CONTACT" && !sellerContact && !attachments.length) {
    return { ok: false, error: "Приложите скриншот или QR-код продавца, или напишите его контакт" };
  }
  if (!productName) return { ok: false, error: "Коротко напишите, что за товар" };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { ok: false, error: "Количество — от 1 до 999" };

  const settings = await getBuyoutSettings();
  const buyout = await prisma.$transaction(async (tx) => {
    const created = await tx.buyout.create({
      data: {
        number: await nextDocumentNumber(tx, "buyout", { prefix: settings.numberPrefix }),
        companyId: settings.companyId,
        customerId,
        kind,
        url,
        sellerContact: sellerContact || null,
        attachments: attachments.length ? attachments : undefined,
        productName,
        variant: variant || null,
        quantity,
        customerComment: comment || null,
        createdById: staffId,
      },
    });
    await tx.buyoutStatusHistory.create({
      data: { buyoutId: created.id, status: "NEW", changedById: staffId, byClient: !staffId, note: "Заявка создана" },
    });
    return created;
  });
  after(() => notifyOwnerNewBuyout(buyout.id));
  revalidatePath("/cabinet/buyouts");
  revalidatePath("/buyouts");
  redirect(`/cabinet/buyouts?created=${encodeURIComponent(buyout.number)}`);
}

/**
 * «Оплатить с баланса»: списать итог выкупа, если хватает. Деньги клиента заняты на время списания
 * (lib/balance.ts, lockClientMoney); цену, которую видел клиент, сверяем — менеджер мог её поменять.
 */
export async function payBuyoutFromBalance(buyoutId: string, expectedTotal: string): Promise<CabinetResult> {
  const { customerId, staffId } = await actor();
  try {
    const result = await prisma.$transaction(async (tx): Promise<CabinetResult> => {
      await lockClientMoney(tx, customerId);
      const buyout = await tx.buyout.findFirst({ where: { id: buyoutId, customerId, deletedAt: null } });
      if (!buyout) return { ok: false, error: "Выкуп не найден" };
      if (buyout.status !== "PRICED" || buyout.totalCny == null) return { ok: false, error: "Оплатить можно, когда цена назначена" };
      const total = round2(Number(buyout.totalCny));
      if (total !== round2(Number(expectedTotal))) return { ok: false, error: "Цена изменилась — обновите страницу" };
      const balance = await clientBalance(customerId, tx);
      if (balance < total) return { ok: false, error: `Не хватает ${yuan(round2(total - balance))} — пополните баланс`, shortBy: round2(total - balance) };

      const updated = await tx.buyout.updateMany({ where: { id: buyout.id, status: "PRICED", totalCny: buyout.totalCny }, data: { status: "PAID", paidAt: new Date() } });
      if (!updated.count) return { ok: false, error: "Выкуп уже изменили — обновите страницу" };
      await addLedgerEntry(tx, {
        customerId,
        amount: total,
        reason: "BUYOUT_PAYMENT",
        note: `Оплата выкупа ${buyout.number}`,
        createdById: staffId,
        buyoutId: buyout.id,
      });
      await tx.buyoutStatusHistory.create({
        data: { buyoutId: buyout.id, status: "PAID", changedById: staffId, byClient: !staffId, note: `Оплачено с баланса ${yuan(total)}` },
      });
      return { ok: true, message: `Оплачено ${yuan(total)}` };
    });
    if (result.ok) {
      after(async () => {
        await notifyBuyoutClient(buyoutId, "paid");
        await notifyOwnerBuyoutPaid(buyoutId);
      });
      revalidatePath("/cabinet/buyouts");
      revalidatePath("/buyouts");
      revalidatePath(`/buyouts/${buyoutId}`);
    }
    return result;
  } catch (error) {
    console.error("[buyout-cabinet] pay:", error);
    return { ok: false, error: "Не получилось оплатить — попробуйте ещё раз" };
  }
}

/** Клиент отменяет заявку, пока не оплатил. */
export async function cancelBuyoutRequest(buyoutId: string): Promise<CabinetResult> {
  const { customerId, staffId } = await actor();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.buyout.updateMany({
      where: { id: buyoutId, customerId, deletedAt: null, status: { in: ["NEW", "PRICED"] } },
      data: { status: "CANCELED" },
    });
    if (result.count) {
      await tx.buyoutStatusHistory.create({
        data: { buyoutId, status: "CANCELED", changedById: staffId, byClient: !staffId, note: "Отменена клиентом" },
      });
    }
    return result.count;
  });
  if (!updated) return { ok: false, error: "Отменить можно до оплаты. После оплаты напишите менеджеру." };
  revalidatePath("/cabinet/buyouts");
  revalidatePath("/buyouts");
  return { ok: true, message: "Заявка отменена" };
}

/** Заявка на пополнение баланса: сумма, способ, номер платежа, скриншот. Зачисляет сотрудник после проверки. */
export async function createTopUpRequest(formData: FormData): Promise<CabinetResult> {
  const { customerId, staffId } = await actor();
  const amount = parseMoney(formData.get("amount"));
  const settings = await getBuyoutSettings();
  const method = text(formData.get("method"), 80);
  const reference = paymentReference(text(formData.get("reference"), 120));
  const screenshotUrl = ownBuyoutFileUrl(formData.get("screenshotUrl"), customerId);
  const note = text(formData.get("note"), 500);

  if (amount == null || amount <= 0) return { ok: false, error: "Укажите сумму пополнения" };
  if (amount > 1_000_000) return { ok: false, error: "Слишком большая сумма — напишите менеджеру" };
  if (settings.topUpMethods.length && !settings.topUpMethods.includes(method)) return { ok: false, error: "Выберите способ оплаты" };
  if (!reference && !screenshotUrl) return { ok: false, error: "Приложите скриншот оплаты или укажите номер платежа" };

  const request = await prisma.$transaction(async (tx) =>
    tx.topUpRequest.create({
      data: {
        number: await nextDocumentNumber(tx, "topUpRequest"),
        customerId,
        amount,
        currency: "CNY",
        method: method || null,
        reference,
        screenshotUrl,
        note: note || null,
        createdById: staffId,
      },
    })
  );
  after(() => notifyOwnerTopUp(request.id));
  revalidatePath("/cabinet/buyouts/balance");
  revalidatePath("/top-ups");
  return { ok: true, message: `Заявка ${request.number} отправлена. Зачислим после проверки оплаты.` };
}
