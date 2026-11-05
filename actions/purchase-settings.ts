"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { customPrefix } from "@/lib/document-numbers";
import { parseMoney } from "@/lib/purchase-money";
import { purchaseCompanyId } from "@/lib/purchases";

export type SettingsResult = { ok: true } | { ok: false; error: string };

const lines = (value: FormDataEntryValue | null, max: number) =>
  [...new Set(String(value ?? "").split("\n").map((line) => line.trim().slice(0, 120)).filter(Boolean))].slice(0, max);
const text = (value: FormDataEntryValue | null, max: number) => String(value ?? "").trim().slice(0, max) || null;

/** «Покупки → Настройки покупки»: свои у компании клиентов. */
export async function savePurchaseSettings(formData: FormData): Promise<SettingsResult> {
  const session = await requireAdmin();
  const commissionPercent = parseMoney(formData.get("commissionPercent"));
  const commissionMinCny = parseMoney(formData.get("commissionMinCny"));
  const topUpConfirmAboveCny = parseMoney(formData.get("topUpConfirmAboveCny"));
  const rawPrefix = String(formData.get("numberPrefix") ?? "").trim();
  const numberPrefix = rawPrefix ? customPrefix("purchase", rawPrefix) : null;

  if (commissionPercent != null && (commissionPercent < 0 || commissionPercent > 100)) return { ok: false, error: "Процент комиссии — от 0 до 100" };
  if (commissionMinCny != null && commissionMinCny < 0) return { ok: false, error: "Минимальная комиссия не может быть меньше нуля" };
  if (topUpConfirmAboveCny != null && topUpConfirmAboveCny < 0) return { ok: false, error: "Порог не может быть меньше нуля" };
  if (rawPrefix && !numberPrefix) return { ok: false, error: "Префикс — 1–5 латинских букв, не занятых другими документами (ZK, PS, PB…)" };

  const data = {
    clientBuyoutOnly: formData.get("clientBuyoutOnly") === "on",
    commissionPercent,
    commissionMinCny,
    numberPrefix,
    rejectReasons: lines(formData.get("rejectReasons"), 30),
    rulesText: text(formData.get("rulesText"), 4000),
    topUpMethods: lines(formData.get("topUpMethods"), 20),
    topUpInstructions: text(formData.get("topUpInstructions"), 4000),
    topUpConfirmAboveCny,
    updatedBy: session.user.id,
  };
  const companyId = await purchaseCompanyId();
  const existing =
    (companyId ? await prisma.purchaseSettings.findUnique({ where: { companyId } }) : null) ??
    (await prisma.purchaseSettings.findFirst({ where: { companyId: null } }));
  if (existing) await prisma.purchaseSettings.update({ where: { id: existing.id }, data: { ...data, companyId: existing.companyId ?? companyId } });
  else await prisma.purchaseSettings.create({ data: { ...data, companyId } });

  revalidatePath("/purchases/settings");
  revalidatePath("/cabinet/purchases");
  return { ok: true };
}
