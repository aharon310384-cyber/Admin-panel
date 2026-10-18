"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { getQuota, Track17RequestError } from "@/lib/track17";
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
