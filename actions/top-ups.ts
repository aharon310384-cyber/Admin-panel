"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { nextDocumentNumber } from "@/lib/document-numbers";
import { addLedgerEntry, lockClientMoney, paymentReference, paymentReferenceUsed } from "@/lib/balance";
import { parseMoney, yuan } from "@/lib/purchase-money";
import { getPurchaseSettings } from "@/lib/purchases";
import { notifyTopUpClient } from "@/lib/purchase-notify";

// Зачисление пополнения баланса — правила безопасности денег (docs/product/будущее.md, раздел 8):
// 1) зачисляет только администратор (отдельного права «деньги» в программе пока нет);
// 2) номер платежа и скриншот — в заявке, один номер платежа не зачисляется дважды;
// 3) кто, когда и сколько — в приходе ДС и регистре; удалить нельзя, только сторно (обратная запись);
// 4) сумма больше порога из настроек — с повторным вводом пароля (порог не задан — пароль всегда);
// 5) клиенту — сообщение о зачислении (и о каждом списании — lib/purchase-notify.ts).

export type TopUpResult = { ok: true; message?: string } | { ok: false; error: string };

const text = (value: FormDataEntryValue | null, max = 300) => (typeof value === "string" ? value.trim().slice(0, max) : "");

class StepError extends Error {}

async function passwordOk(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  return Boolean(user && password && (await bcrypt.compare(password, user.password)));
}

async function run(id: string, work: () => Promise<string>): Promise<TopUpResult> {
  try {
    const message = await work();
    revalidatePath("/top-ups");
    revalidatePath(`/top-ups/${id}`);
    revalidatePath("/cabinet/purchases/balance");
    revalidatePath("/cabinet/purchases");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof StepError) return { ok: false, error: error.message };
    console.error("[top-ups]", error);
    return { ok: false, error: "Не получилось — попробуйте ещё раз" };
  }
}

/** «Зачислить»: приход ДС (PD-…) и запись в регистре — баланс клиента вырос. */
export async function creditTopUp(id: string, formData: FormData): Promise<TopUpResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const amount = parseMoney(formData.get("amount"));
    const method = text(formData.get("method"), 80);
    const reference = paymentReference(text(formData.get("reference"), 120));
    const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
    if (amount == null || amount <= 0) throw new StepError("Укажите сумму, которая пришла");
    if (!reference) throw new StepError("Укажите номер платежа — по нему видно, что платёж не зачислен дважды");

    const { topUpConfirmAboveCny } = await getPurchaseSettings();
    if ((topUpConfirmAboveCny == null || amount > topUpConfirmAboveCny) && !(await passwordOk(session.user.id, password))) {
      throw new StepError(password ? "Неверный пароль" : "Введите свой пароль, чтобы подтвердить зачисление");
    }

    const request = await prisma.$transaction(async (tx) => {
      const req = await tx.topUpRequest.findUnique({ where: { id } });
      if (!req || req.deletedAt) throw new StepError("Заявка не найдена");
      if (await paymentReferenceUsed(tx, reference)) throw new StepError(`Платёж ${reference} уже зачислен — второй раз нельзя`);
      await lockClientMoney(tx, req.customerId);
      const moved = await tx.topUpRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "PAID" } });
      if (!moved.count) throw new StepError("Заявку уже обработали — обновите страницу");
      const payment = await tx.payment.create({
        data: {
          number: await nextDocumentNumber(tx, "payment"),
          customerId: req.customerId,
          topUpRequestId: req.id,
          amount,
          currency: "CNY",
          method: method || req.method,
          reference,
          note: `Пополнение баланса по заявке ${req.number}`,
          createdById: session.user.id,
        },
      });
      await addLedgerEntry(tx, {
        customerId: req.customerId,
        amount: -amount,
        reason: "TOP_UP",
        note: `Пополнение по заявке ${req.number}, приход ${payment.number}`,
        createdById: session.user.id,
        paymentId: payment.id,
      });
      if (amount !== Number(req.amount)) {
        await tx.topUpRequest.update({ where: { id }, data: { amount } });
      }
      return req;
    });
    after(() => notifyTopUpClient(id, "credited"));
    return `Зачислено ${yuan(amount)} клиенту по заявке ${request.number}`;
  });
}

/** «Отклонить»: оплата не нашлась или не та сумма — с причиной, клиенту сообщение. */
export async function cancelTopUp(id: string, formData: FormData): Promise<TopUpResult> {
  await requireAdmin();
  return run(id, async () => {
    const reason = text(formData.get("reason"));
    if (!reason) throw new StepError("Укажите причину — её увидит клиент");
    const moved = await prisma.topUpRequest.updateMany({ where: { id, status: "PENDING", deletedAt: null }, data: { status: "CANCELED", cancelReason: reason } });
    if (!moved.count) throw new StepError("Заявку уже обработали — обновите страницу");
    after(() => notifyTopUpClient(id, "canceled"));
    return "Заявка отклонена";
  });
}

/**
 * «Сторно»: зачислили по ошибке. Зачисление не удаляется — в регистре обратная запись на ту же сумму,
 * приход ДС помечается на удаление (его номер платежа освобождается), заявка — «Отклонена» с причиной.
 * Если клиент уже потратил эти деньги, баланс станет меньше нуля — это его долг.
 */
export async function stornoTopUp(id: string, formData: FormData): Promise<TopUpResult> {
  const session = await requireAdmin();
  return run(id, async () => {
    const reason = text(formData.get("reason"));
    const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
    if (!reason) throw new StepError("Укажите причину сторно");
    if (!(await passwordOk(session.user.id, password))) throw new StepError(password ? "Неверный пароль" : "Введите свой пароль");

    await prisma.$transaction(async (tx) => {
      const req = await tx.topUpRequest.findUnique({
        where: { id },
        include: { payments: { where: { deletedAt: null }, include: { ledgerEntries: { where: { reason: "TOP_UP", deletedAt: null } } } } },
      });
      if (!req || req.status !== "PAID") throw new StepError("Сторно — только у зачисленной заявки");
      await lockClientMoney(tx, req.customerId);
      const moved = await tx.topUpRequest.updateMany({ where: { id, status: "PAID" }, data: { status: "CANCELED", cancelReason: `Сторно: ${reason}` } });
      if (!moved.count) throw new StepError("Заявку уже изменили — обновите страницу");
      for (const payment of req.payments) {
        const credited = payment.ledgerEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
        if (credited !== 0) {
          await addLedgerEntry(tx, {
            customerId: req.customerId,
            amount: -credited,
            reason: "ADJUSTMENT",
            note: `Сторно зачисления ${payment.number} по заявке ${req.number}: ${reason}`,
            createdById: session.user.id,
            paymentId: payment.id,
          });
        }
        await tx.payment.update({ where: { id: payment.id }, data: { deletedAt: new Date(), note: `${payment.note ?? ""} · сторно: ${reason}`.trim() } });
      }
    });
    after(() => notifyTopUpClient(id, "storno"));
    return "Зачисление сторнировано";
  });
}
