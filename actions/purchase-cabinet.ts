"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { nextDocumentNumber } from "@/lib/document-numbers";
import { addLedgerEntry, clientBalance, lockClientMoney, paymentReference } from "@/lib/balance";
import { commissionFor, parseMoney, round2, yuan } from "@/lib/purchase-money";
import { firstLink, marketplaceOf } from "@/lib/purchase-lines";
import { attachmentsFromForm, ownPurchaseFileUrl, PURCHASE_FILES_MAX } from "@/lib/purchase-files";
import { estimatePurchase, type PurchaseEstimate, type PurchaseServicesWanted } from "@/lib/purchase-estimate";
import { getPurchaseSettings, purchasePaidNet, settlePurchase } from "@/lib/purchases";
import { notifyOwnerNewPurchase, notifyOwnerPurchasePaid, notifyOwnerTopUp, notifyPurchaseClient } from "@/lib/purchase-notify";

// Действия клиента в кабинете: «Хочу купить» (корзина), ориентировочная цена, оплата и доплата с баланса, отмена,
// заявка на пополнение. Клиент видит и меняет только свои покупки: id клиента — из его сессии, не из формы.
// В режиме «просмотр кабинета» действует сотрудник за клиента — он и пишется автором.

export type CabinetResult = { ok: true; message?: string } | { ok: false; error: string; shortBy?: number };

const text = (value: unknown, max = 500) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const MAX_LINES = 20;

async function actor() {
  const { client, mode, session } = await getClientCabinetContext();
  return { customerId: client.id, staffId: mode === "admin" ? session?.user.id ?? null : null };
}

type CartLine = { kind: "LINK" | "CONTACT"; url: string | null; sellerContact: string; attachments: ReturnType<typeof attachmentsFromForm>; productName: string; variant: string; quantity: number; unitPriceCny: number | null };

function readServices(get: (name: string) => unknown): PurchaseServicesWanted {
  const on = (name: string) => get(name) === "on" || get(name) === true;
  return {
    consolidation: on("consolidationRequested"),
    compactPack: on("compactPackRequested"),
    standardCheck: on("standardCheckRequested"),
    detailedCheck: on("detailedCheckRequested"),
    reinforcedPack: on("reinforcedPackRequested"),
    keepOriginal: on("keepOriginalPackaging"),
  };
}

function readCart(raw: unknown, customerId: string): CartLine[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, MAX_LINES).map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const rawLink = text(row.url, 3000);
    return {
      kind: row.kind === "CONTACT" ? "CONTACT" : "LINK",
      url: rawLink ? firstLink(rawLink) : null,
      sellerContact: text(row.sellerContact, 300),
      attachments: attachmentsFromForm(JSON.stringify(Array.isArray(row.attachments) ? row.attachments : []), customerId).slice(0, PURCHASE_FILES_MAX),
      productName: text(row.productName, 200),
      variant: text(row.variant, 200),
      quantity: Number(row.quantity || 1),
      unitPriceCny: parseMoney(text(row.unitPriceCny, 20)),
    };
  });
}

export type CartEstimate = {
  goodsCny: number;
  commissionCny: number | null;
  goodsKnown: boolean; // у всех строк указана цена
  estimate: PurchaseEstimate | null; // для «под ключ»
};

/** Ориентировочная цена корзины — пока клиент её заполняет. Ничего не сохраняет. */
export async function estimateCart(input: {
  mode: "TURNKEY" | "BUYOUT_ONLY";
  countryCode: string;
  deliveryType: string;
  weightKg: string;
  lines: { quantity: number; unitPriceCny: string }[];
  services: Record<string, boolean>;
}): Promise<CartEstimate> {
  await actor();
  const settings = await getPurchaseSettings();
  const lines = input.lines.slice(0, MAX_LINES).map((l) => ({ quantity: Math.max(1, Math.min(999, Number(l.quantity) || 1)), price: parseMoney(l.unitPriceCny) }));
  const goodsCny = round2(lines.reduce((sum, l) => sum + (l.price ?? 0) * l.quantity, 0));
  const estimate =
    input.mode === "TURNKEY"
      ? await estimatePurchase({
          countryCode: text(input.countryCode, 2).toUpperCase() || null,
          deliveryType: text(input.deliveryType, 20) || null,
          weightKg: parseMoney(input.weightKg),
          lineCount: Math.max(1, lines.length),
          goodsCny,
          services: readServices((name) => input.services?.[name]),
        })
      : null;
  return {
    goodsCny,
    commissionCny: commissionFor(goodsCny, { percent: settings.commissionPercent, minCny: settings.commissionMinCny }),
    goodsKnown: lines.length > 0 && lines.every((l) => l.price != null && l.price > 0),
    estimate,
  };
}

/** «Хочу купить»: новая покупка — корзина товаров и (под ключ) куда доставить. */
export async function createPurchase(formData: FormData): Promise<CabinetResult> {
  const { customerId, staffId } = await actor();
  const settings = await getPurchaseSettings();
  const lines = readCart(formData.get("lines"), customerId);
  const wantsBuyoutOnly = formData.get("mode") === "BUYOUT_ONLY";
  if (wantsBuyoutOnly && !settings.clientBuyoutOnly && !staffId) return { ok: false, error: "«Только выкуп» сейчас недоступен — выберите «Под ключ»" };
  const mode = wantsBuyoutOnly ? "BUYOUT_ONLY" : "TURNKEY";
  const countryCode = text(formData.get("countryCode"), 2).toUpperCase() || null;
  const deliveryType = text(formData.get("deliveryType"), 20) || null;
  const recipientId = text(formData.get("recipientId"), 40) || null;
  const weight = parseMoney(formData.get("estimatedWeightKg"));
  const comment = text(formData.get("customerComment"), 1000);
  const services = readServices((name) => formData.get(name));

  if (!lines.length) return { ok: false, error: "Добавьте хотя бы один товар" };
  for (const [index, line] of lines.entries()) {
    const no = `Товар ${index + 1}`;
    if (line.kind === "LINK" && !line.url) return { ok: false, error: `${no}: вставьте ссылку (начинается с http)` };
    if (line.kind === "CONTACT" && !line.sellerContact && !line.attachments.length) return { ok: false, error: `${no}: приложите скриншот или QR-код продавца, или напишите его контакт` };
    if (!line.productName) return { ok: false, error: `${no}: коротко напишите, что за товар` };
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 999) return { ok: false, error: `${no}: количество — от 1 до 999` };
    if (line.unitPriceCny != null && line.unitPriceCny < 0) return { ok: false, error: `${no}: цена не может быть меньше нуля` };
  }
  if (mode === "TURNKEY" && !countryCode) return { ok: false, error: "Выберите страну получения" };
  if (countryCode && !(await prisma.country.findUnique({ where: { code: countryCode }, select: { code: true } }))) return { ok: false, error: "Нет такой страны" };
  if (recipientId && !(await prisma.recipient.findFirst({ where: { id: recipientId, customerId, deletedAt: null }, select: { id: true } }))) {
    return { ok: false, error: "Получатель не найден — выберите из списка" };
  }
  if (deliveryType && !(await prisma.deliveryMethod.findUnique({ where: { code: deliveryType }, select: { code: true } }))) return { ok: false, error: "Нет такого вида доставки" };
  if (weight != null && (weight < 0 || weight > 1000)) return { ok: false, error: "Примерный вес — от 0 до 1000 кг" };

  const turnkey = mode === "TURNKEY";
  const goodsCny = round2(lines.reduce((sum, l) => sum + (l.unitPriceCny ?? 0) * l.quantity, 0));
  const estimate = turnkey ? await estimatePurchase({ countryCode, deliveryType, weightKg: weight, lineCount: lines.length, goodsCny, services }) : null;

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        number: await nextDocumentNumber(tx, "purchase", { prefix: settings.numberPrefix }),
        companyId: settings.companyId,
        customerId,
        mode,
        countryCode: turnkey ? countryCode : null,
        recipientId: turnkey ? recipientId : null,
        deliveryType: turnkey ? deliveryType : null,
        estimatedWeightKg: weight,
        consolidationRequested: turnkey && services.consolidation,
        compactPackRequested: turnkey && services.compactPack,
        standardCheckRequested: services.standardCheck,
        detailedCheckRequested: services.detailedCheck,
        reinforcedPackRequested: turnkey && services.reinforcedPack,
        keepOriginalPackaging: services.keepOriginal,
        customerComment: comment || null,
        shippingEstimateCny: estimate?.shippingCny ?? null,
        servicesEstimateCny: estimate?.servicesCny ?? null,
        dutyEstimateCny: estimate?.dutyCny ?? null,
        createdById: staffId,
        lines: {
          create: lines.map((line, index) => ({
            lineNo: index + 1,
            kind: line.kind,
            url: line.url,
            sellerContact: line.sellerContact || null,
            attachments: line.attachments.length ? line.attachments : undefined,
            marketplace: line.kind === "CONTACT" ? "WECHAT" : marketplaceOf(line.url),
            productName: line.productName,
            variant: line.variant || null,
            quantity: line.quantity,
            unitPriceCny: line.unitPriceCny,
          })),
        },
      },
    });
    await tx.purchaseStatusHistory.create({
      data: { purchaseId: created.id, status: "NEW", changedById: staffId, byClient: !staffId, note: `Заявка: товаров ${lines.length}` },
    });
    return created;
  });
  after(() => notifyOwnerNewPurchase(purchase.id));
  revalidatePath("/cabinet/purchases");
  revalidatePath("/purchases");
  redirect(`/cabinet/purchases?created=${encodeURIComponent(purchase.number)}`);
}

/**
 * «Оплатить с баланса»: первое списание — товар + доставка по Китаю + комиссия; потом — доплата, если цена выросла.
 * Деньги клиента заняты на время списания; сумму, которую видел клиент, сверяем — менеджер мог её поменять.
 */
export async function payPurchase(purchaseId: string, expectedDue: string): Promise<CabinetResult> {
  const { customerId, staffId } = await actor();
  try {
    const result = await prisma.$transaction(async (tx): Promise<{ res: CabinetResult; amount: number }> => {
      const fail = (error: string, shortBy?: number) => ({ res: { ok: false as const, error, shortBy }, amount: 0 });
      await lockClientMoney(tx, customerId);
      const purchase = await tx.purchase.findFirst({ where: { id: purchaseId, customerId, deletedAt: null } });
      if (!purchase) return fail("Покупка не найдена");
      if (purchase.totalCny == null || !["PRICED", "PAID", "PURCHASED", "AT_WAREHOUSE"].includes(purchase.status)) {
        return fail("Оплатить можно, когда цена назначена");
      }
      const due = round2(Number(purchase.totalCny) - (await purchasePaidNet(tx, purchaseId)));
      if (due <= 0) return fail("Покупка уже оплачена");
      if (due !== round2(Number(expectedDue))) return fail("Сумма изменилась — обновите страницу");
      const balance = await clientBalance(customerId, tx);
      if (balance < due) return fail(`Не хватает ${yuan(round2(due - balance))} — пополните баланс`, round2(due - balance));

      const first = purchase.status === "PRICED";
      await addLedgerEntry(tx, {
        customerId,
        amount: due,
        reason: "PURCHASE_PAYMENT",
        note: `${first ? "Оплата" : "Доплата"} покупки ${purchase.number}`,
        createdById: staffId,
        purchaseId,
      });
      if (first) {
        const moved = await tx.purchase.updateMany({ where: { id: purchaseId, status: "PRICED", totalCny: purchase.totalCny }, data: { status: "PAID", paidAt: new Date() } });
        if (!moved.count) throw new Error("price changed");
      }
      await tx.purchaseStatusHistory.create({
        data: { purchaseId, status: first ? "PAID" : purchase.status, changedById: staffId, byClient: !staffId, note: `${first ? "Оплачено" : "Доплачено"} с баланса ${yuan(due)}` },
      });
      if (!first) await settlePurchase(tx, purchaseId, { staffId, byClient: !staffId });
      return { res: { ok: true, message: `${first ? "Оплачено" : "Доплачено"} ${yuan(due)}` }, amount: due };
    });
    if (result.res.ok) {
      after(async () => {
        await notifyPurchaseClient(purchaseId, "paid");
        await notifyOwnerPurchasePaid(purchaseId, result.amount);
      });
      revalidatePath("/cabinet/purchases");
      revalidatePath("/purchases");
      revalidatePath(`/purchases/${purchaseId}`);
    }
    return result.res;
  } catch (error) {
    console.error("[purchase-cabinet] pay:", error);
    return { ok: false, error: "Не получилось оплатить — обновите страницу и попробуйте ещё раз" };
  }
}

/** Клиент отменяет покупку, пока не оплатил. */
export async function cancelPurchase(purchaseId: string): Promise<CabinetResult> {
  const { customerId, staffId } = await actor();
  const updated = await prisma.$transaction(async (tx) => {
    await lockClientMoney(tx, customerId);
    const result = await tx.purchase.updateMany({
      where: { id: purchaseId, customerId, deletedAt: null, status: { in: ["NEW", "PRICED"] } },
      data: { status: "CANCELED" },
    });
    if (result.count) {
      await tx.purchaseStatusHistory.create({ data: { purchaseId, status: "CANCELED", changedById: staffId, byClient: !staffId, note: "Отменена клиентом" } });
    }
    return result.count;
  });
  if (!updated) return { ok: false, error: "Отменить можно до оплаты. После оплаты напишите менеджеру." };
  revalidatePath("/cabinet/purchases");
  revalidatePath("/purchases");
  return { ok: true, message: "Покупка отменена" };
}

/** Заявка на пополнение баланса: сумма, способ, номер платежа, скриншот. Зачисляет сотрудник после проверки. */
export async function createTopUpRequest(formData: FormData): Promise<CabinetResult> {
  const { customerId, staffId } = await actor();
  const amount = parseMoney(formData.get("amount"));
  const settings = await getPurchaseSettings();
  const method = text(formData.get("method"), 80);
  const reference = paymentReference(text(formData.get("reference"), 120));
  const screenshotUrl = ownPurchaseFileUrl(formData.get("screenshotUrl"), customerId);
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
  revalidatePath("/cabinet/purchases/balance");
  revalidatePath("/top-ups");
  return { ok: true, message: `Заявка ${request.number} отправлена. Зачислим после проверки оплаты.` };
}

