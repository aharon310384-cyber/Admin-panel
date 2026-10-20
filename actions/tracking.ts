"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { getCarriers, getQuota, Track17RequestError, type Track17Carrier } from "@/lib/track17";
import { TRACKING_LANGS } from "@/lib/tracking-labels";
import { getTrackingKey, syncTracking, type SyncResult } from "@/lib/tracking";

// Отслеживание посылок (17TRACK): ключ API, проверка связи и проверка посылок по кнопке.

export type TrackingActionResult = { ok: boolean; message: string };

async function checkKey(key: string): Promise<TrackingActionResult> {
  try {
    const quota = await getQuota(key);
    return { ok: true, message: `Связь с 17TRACK есть. Можно поставить на слежение ещё ${quota.quota_remain} из ${quota.quota_total} номеров.` };
  } catch (error) {
    if (error instanceof Track17RequestError) return { ok: false, message: error.message };
    throw error;
  }
}

/** Сохранить ключ API 17TRACK — только администратор и только рабочий ключ. */
export async function saveTrackingKey(apiKey: string): Promise<TrackingActionResult> {
  const session = await requireAdmin();
  const key = apiKey.trim();
  if (!/^[\w-]{8,200}$/.test(key)) return { ok: false, message: "Ключ выглядит неверно: вставьте его из кабинета 17TRACK целиком" };
  const check = await checkKey(key);
  if (!check.ok) return check;
  const existing = await prisma.trackingSettings.findFirst({ select: { id: true } });
  const data = { apiKey: key, updatedBy: session.user.id };
  if (existing) await prisma.trackingSettings.update({ where: { id: existing.id }, data });
  else await prisma.trackingSettings.create({ data });
  revalidatePath("/settings");
  return { ok: true, message: `Ключ сохранён. ${check.message}` };
}

export async function removeTrackingKey(): Promise<TrackingActionResult> {
  const session = await requireAdmin();
  await prisma.trackingSettings.updateMany({ data: { apiKey: null, updatedBy: session.user.id } });
  revalidatePath("/settings");
  return { ok: true, message: "Ключ удалён, отслеживание выключено" };
}

/** Проверить связь с 17TRACK и остаток квоты. */
export async function checkTrackingConnection(): Promise<TrackingActionResult> {
  if (!(await auth())) return { ok: false, message: "Не авторизован" };
  const key = await getTrackingKey();
  if (!key) return { ok: false, message: "Ключ 17TRACK не задан" };
  return checkKey(key);
}

/** Проверить все отправленные посылки сейчас, не дожидаясь расписания. */
export async function syncTrackingNow(): Promise<SyncResult> {
  if (!(await auth())) return { ok: false, message: "Не авторизован" };
  const result = await syncTracking();
  revalidatePath("/settings");
  revalidatePath("/parcels");
  return result;
}

/** Обновить отслеживание одной посылки (кнопка в карточке). Ставит номер на слежение, если он ещё не стоит. */
export async function refreshParcelTracking(parcelId: string): Promise<SyncResult> {
  if (!(await auth())) return { ok: false, message: "Не авторизован" };
  const result = await syncTracking({ parcelIds: [parcelId] });
  revalidatePath(`/parcels/${parcelId}`);
  revalidatePath("/parcels");
  return result;
}

/** Перевозчики 17TRACK по названию — для выбора запасного перевозчика. */
export async function searchTrackingCarriers(query: string): Promise<{ ok: boolean; message?: string; carriers: Track17Carrier[] }> {
  await requireAdmin();
  const q = query.trim().toLowerCase();
  if (q.length < 2) return { ok: true, carriers: [] };
  try {
    const list = await getCarriers();
    return { ok: true, carriers: list.filter((c) => c.name.toLowerCase().includes(q) || String(c.key) === q).slice(0, 20) };
  } catch (error) {
    if (error instanceof Track17RequestError) return { ok: false, message: error.message, carriers: [] };
    throw error;
  }
}

/** Язык событий и запасной перевозчик (номера с приставками → этот перевозчик, если 17TRACK сам не нашёл). */
export async function saveTrackingOptions(input: {
  lang: string;
  fallbackPrefixes: string;
  fallbackCarrier: number | null;
  fallbackCarrierName: string | null;
  fallbackAfterHours: number;
}): Promise<TrackingActionResult> {
  const session = await requireAdmin();
  const lang = TRACKING_LANGS.some(([code]) => code === input.lang) ? input.lang : "ru";
  const prefixes = input.fallbackPrefixes
    .split(/[\s,;]+/)
    .map((p) => p.trim().toUpperCase())
    .filter((p) => /^[A-Z0-9]{1,10}$/.test(p));
  const carrier = input.fallbackCarrier && Number.isInteger(input.fallbackCarrier) && input.fallbackCarrier > 0 ? input.fallbackCarrier : null;
  const hours = Math.min(Math.max(Math.round(Number(input.fallbackAfterHours) || 24), 1), 24 * 14);
  if (prefixes.length && !carrier) return { ok: false, message: "Выберите запасного перевозчика или очистите приставки" };
  const data = {
    lang,
    fallbackPrefixes: prefixes.length ? [...new Set(prefixes)].join(", ") : null,
    fallbackCarrier: carrier,
    fallbackCarrierName: carrier ? input.fallbackCarrierName?.trim().slice(0, 120) || null : null,
    fallbackAfterHours: hours,
    updatedBy: session.user.id,
  };
  const existing = await prisma.trackingSettings.findFirst({ select: { id: true } });
  if (existing) await prisma.trackingSettings.update({ where: { id: existing.id }, data });
  else await prisma.trackingSettings.create({ data });
  revalidatePath("/settings");
  return { ok: true, message: "Настройки отслеживания сохранены" };
}
