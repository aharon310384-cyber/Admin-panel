import "server-only";

import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureBaseline, recordVersion } from "@/lib/versions";
import { notifyParcelStatusChange } from "@/lib/notify";
import {
  ALREADY_REGISTERED,
  BATCH,
  QUOTA_RAN_OUT,
  Track17RequestError,
  getTrackInfo,
  register,
  type Track17Event,
  type Track17Item,
} from "@/lib/track17";

// Отслеживание посылок через 17TRACK.
// Следим за посылками «Отправлена» с трек-номером: ставим номер на слежение (тратит квоту), дальше забираем состояние.
// «Доставлена» в 17TRACK — посылка становится «Доставлена» сама: история статусов, версия, сообщение клиенту в Telegram.
// Возврат, «не удалось вручить», запрос таможни, долго нет данных — отметка «проблема», статус меняет человек.
// Запуск: по расписанию (cron → /api/tracking/sync), «Проверить сейчас» в настройках, «Обновить» в карточке посылки.

/** Сами ставим на слежение посылки, отправленные за последние столько дней; более старые — кнопкой в карточке. */
const RECENT_DAYS = 60;
/** Столько дней на слежении без данных — «проблема». */
const NO_DATA_DAYS = 14;
const MAX_EVENTS = 50;
const DAY = 24 * 60 * 60 * 1000;
const NOT_REGISTERED = -18019902;

const PROBLEM_STATUSES = new Set(["Exception", "DeliveryFailure", "Expired"]);
const PROBLEM_SUB_STATUSES = new Set(["InTransit_CustomsRequiringInformation"]);

export type TrackingEvent = { at: string | null; text: string; location: string | null };
export type SyncResult = { ok: boolean; message: string };

type Counters = { registered: number; updated: number; delivered: number; errors: string[] };
type Target = { parcelId: string; number: string; carrier?: number | null };

/** Номер для слежения: без пробелов, заглавными. */
export function normalizeTrackNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export async function getTrackingKey(): Promise<string | null> {
  const settings = await prisma.trackingSettings.findFirst({ select: { apiKey: true } });
  return settings?.apiKey?.trim() || null;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function byNumber(targets: Target[]): Map<string, Target[]> {
  const map = new Map<string, Target[]>();
  for (const target of targets) map.set(target.number, [...(map.get(target.number) ?? []), target]);
  return map;
}

function eventTime(event: Track17Event): Date | null {
  const raw = event.time_utc || event.time_iso;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function eventText(event: Track17Event | null | undefined): string | null {
  return (event?.description_translation?.description || event?.description || "").trim() || null;
}

type Registration = { registeredAt: Date | null; carrier?: number | null; error?: string; problem?: boolean };

/** Номер на слежение заново: прежнее состояние стирается. */
async function saveRegistration(target: Target, registration: Registration) {
  const data = {
    number: target.number,
    carrier: registration.carrier ?? null,
    carrierName: null,
    registeredAt: registration.registeredAt,
    status: null,
    subStatus: null,
    event: null,
    location: null,
    eventAt: null,
    events: [],
    problem: registration.problem ?? false,
    error: registration.error ?? null,
    checkedAt: null,
  };
  await prisma.parcelTracking.upsert({ where: { parcelId: target.parcelId }, create: { parcelId: target.parcelId, ...data }, update: data });
}

/** Посылка «Отправлена» → «Доставлена» по данным 17TRACK. Повторный вызов ничего не делает. */
async function markDelivered(parcelId: string, note: string | null): Promise<boolean> {
  await ensureBaseline("parcel", parcelId);
  const { count } = await prisma.parcel.updateMany({
    where: { id: parcelId, status: "SHIPPED", deletedAt: null },
    data: { status: "DELIVERED" },
  });
  if (!count) return false;
  await prisma.parcelStatusHistory.create({
    data: { parcelId, status: "DELIVERED", changedBy: null, note: `17TRACK${note ? `: ${note}` : ""}`.slice(0, 500) },
  });
  await recordVersion("parcel", parcelId, { comment: "Статус «Доставлена» — по данным 17TRACK" });
  await notifyParcelStatusChange(parcelId, "DELIVERED");
  return true;
}

async function applyInfo(target: Target, item: Track17Item, counters: Counters) {
  const info = item.track_info ?? {};
  const status = info.latest_status?.status ?? null;
  const subStatus = info.latest_status?.sub_status ?? null;
  const latest = info.latest_event ?? null;
  const providers = info.tracking?.providers ?? [];
  const events: TrackingEvent[] = providers
    .flatMap((provider) => provider.events ?? [])
    .map((event) => ({ at: eventTime(event)?.toISOString() ?? null, text: eventText(event) ?? "", location: event.location?.trim() || null }))
    .filter((event) => event.text)
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, MAX_EVENTS);

  const current = await prisma.parcelTracking.findUnique({ where: { parcelId: target.parcelId }, select: { registeredAt: true } });
  const noData = (!status || status === "NotFound") && !!current?.registeredAt && Date.now() - current.registeredAt.getTime() > NO_DATA_DAYS * DAY;
  const problem = PROBLEM_STATUSES.has(status ?? "") || PROBLEM_SUB_STATUSES.has(subStatus ?? "") || noData;

  await prisma.parcelTracking.update({
    where: { parcelId: target.parcelId },
    data: {
      carrier: item.carrier ?? undefined,
      carrierName: providers.find((p) => p.provider?.name)?.provider?.name ?? null,
      status,
      subStatus,
      event: eventText(latest),
      location: latest?.location?.trim() || null,
      eventAt: latest ? eventTime(latest) : null,
      events: events as Prisma.InputJsonValue,
      problem,
      error: null,
      checkedAt: new Date(),
    },
  });
  counters.updated++;
  if (status === "Delivered" && (await markDelivered(target.parcelId, eventText(latest)))) counters.delivered++;
}

async function registerTargets(key: string, targets: Target[], counters: Counters): Promise<Target[]> {
  const registered: Target[] = [];
  for (const chunk of chunks(targets, BATCH)) {
    const groups = byNumber(chunk);
    const result = await register(key, [...groups.keys()]);
    for (const item of result.accepted) {
      for (const target of groups.get(item.number) ?? []) {
        await saveRegistration(target, { registeredAt: new Date(), carrier: item.carrier });
        registered.push({ ...target, carrier: item.carrier ?? null });
        counters.registered++;
      }
    }
    for (const item of result.rejected) {
      for (const target of groups.get(item.number) ?? []) {
        if (item.error?.code === ALREADY_REGISTERED) {
          await saveRegistration(target, { registeredAt: new Date() });
          registered.push(target);
          continue;
        }
        const message = item.error?.message || "не удалось поставить на слежение";
        // нет квоты — общая беда, а не этого номера: проблемой посылку не помечаем
        await saveRegistration(target, { registeredAt: null, error: message, problem: item.error?.code !== QUOTA_RAN_OUT });
        counters.errors.push(`${item.number}: ${message}`);
      }
    }
  }
  return registered;
}

async function fetchTargets(key: string, targets: Target[], counters: Counters) {
  for (const chunk of chunks(targets, BATCH)) {
    const groups = byNumber(chunk);
    const result = await getTrackInfo(key, [...groups.values()].map((group) => group[0]));
    for (const item of result.accepted) {
      for (const target of groups.get(item.number) ?? []) await applyInfo(target, item, counters);
    }
    for (const item of result.rejected) {
      const message = item.error?.message || "нет ответа по номеру";
      for (const target of groups.get(item.number) ?? []) {
        // 17TRACK номер забыл — при следующей проверке поставим заново
        const data = item.error?.code === NOT_REGISTERED ? { registeredAt: null, error: message } : { error: message };
        await prisma.parcelTracking.update({ where: { parcelId: target.parcelId }, data: { ...data, checkedAt: new Date() } });
      }
      counters.errors.push(`${item.number}: ${message}`);
    }
  }
}

/**
 * Проверить посылки в 17TRACK. Без parcelIds — все «Отправленные» с трек-номером (по расписанию и из настроек),
 * итог пишется в настройки. С parcelIds — эти посылки в любом статусе и любой давности (кнопка в карточке).
 */
export async function syncTracking({ parcelIds }: { parcelIds?: string[] } = {}): Promise<SyncResult> {
  const all = !parcelIds;
  const key = await getTrackingKey();
  if (!key) return { ok: false, message: "Ключ 17TRACK не задан — «Настройки» → «Отслеживание посылок»" };

  const parcels = await prisma.parcel.findMany({
    where: {
      deletedAt: null,
      trackingNumber: { not: null },
      ...(all ? { status: "SHIPPED" } : { id: { in: parcelIds } }),
    },
    select: {
      id: true,
      trackingNumber: true,
      updatedAt: true,
      tracking: { select: { number: true, registeredAt: true, carrier: true } },
      statusHistory: { where: { status: "SHIPPED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  const since = Date.now() - RECENT_DAYS * DAY;
  const toRegister: Target[] = [];
  const toFetch: Target[] = [];
  for (const parcel of parcels) {
    const number = normalizeTrackNumber(parcel.trackingNumber ?? "");
    if (!number) continue;
    const tracking = parcel.tracking;
    if (tracking?.number === number && tracking.registeredAt) {
      toFetch.push({ parcelId: parcel.id, number, carrier: tracking.carrier });
      continue;
    }
    const shippedAt = parcel.statusHistory[0]?.createdAt ?? parcel.updatedAt;
    if (all && shippedAt.getTime() < since) continue;
    toRegister.push({ parcelId: parcel.id, number });
  }

  const counters: Counters = { registered: 0, updated: 0, delivered: 0, errors: [] };
  let failure: string | null = null;
  try {
    toFetch.push(...(await registerTargets(key, toRegister, counters)));
    await fetchTargets(key, toFetch, counters);
  } catch (error) {
    if (!(error instanceof Track17RequestError)) throw error;
    failure = error.message;
  }

  const problems = await prisma.parcelTracking.count({ where: { problem: true, parcel: { status: "SHIPPED", deletedAt: null } } });
  const parts = [
    `поставлено на слежение ${counters.registered}`,
    `обновлено ${counters.updated}`,
    `доставлено ${counters.delivered}`,
    `требуют внимания ${problems}`,
  ];
  if (counters.errors.length) parts.push(`ошибок по номерам ${counters.errors.length} (${counters.errors.slice(0, 3).join("; ")})`);
  const message = failure ? `${failure}. Успели: ${parts.join(", ")}` : `Готово: ${parts.join(", ")}`;

  if (all) {
    await prisma.trackingSettings.updateMany({ data: { lastSyncAt: new Date(), lastSync: message.slice(0, 1000) } });
  }
  return { ok: !failure, message };
}

/** Поставить посылки на слежение сразу после ответа сотруднику: посылка отправлена или сменился трек-номер. */
export function trackAfterResponse(parcelIds: string[]) {
  if (!parcelIds.length) return;
  after(async () => {
    try {
      if (await getTrackingKey()) await syncTracking({ parcelIds });
    } catch (error) {
      console.error("[tracking]", error);
    }
  });
}
