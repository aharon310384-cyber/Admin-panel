import "server-only";

import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureBaseline, recordVersion } from "@/lib/versions";
import { notifyParcelStatusChange } from "@/lib/notify";
import { notifyOwner } from "@/lib/owner-notify";
import { trackingStatusLabel } from "@/lib/tracking-labels";
import {
  ALREADY_REGISTERED,
  BATCH,
  CARRIER_NOT_DETECTED,
  CHANGE_TOO_EARLY,
  NEEDS_EXTRA_INFO,
  QUOTA_RAN_OUT,
  Track17RequestError,
  changeCarrier,
  getTrackInfo,
  register,
  type Track17Event,
  type Track17Item,
  type Track17RegisterItem,
} from "@/lib/track17";

// Отслеживание посылок через 17TRACK.
// Следим за посылками «Отправлена» с трек-номером: ставим номер на слежение (тратит квоту), дальше забираем состояние.
// «Доставлена» в 17TRACK — посылка становится «Доставлена» сама: история статусов, версия, сообщение клиенту в Telegram.
// Возврат, «не удалось вручить», запрос таможни, долго нет данных — отметка «проблема», статус меняет человек.
// Запуск: по расписанию (cron → /api/tracking/sync), «Проверить сейчас» в настройках, «Обновить» в карточке посылки,
// сразу при отправке посылки, смене трек-номера и загрузке строки из Excel.
// Язык событий и запасной перевозчик — в настройках (TrackingSettings). Запасной перевозчик: номер с его приставкой
// 17TRACK сам не определил или за N часов ничего не нашёл — переставляем на него (один раз).
// Данные получателя (страна, индекс, 4 цифры телефона, дата отправки) отдаём, только если перевозчик их просит.

/** Сами ставим на слежение посылки, отправленные за последние столько дней; более старые — кнопкой в карточке. */
const RECENT_DAYS = 60;
/** Столько дней на слежении без данных — «проблема». */
const NO_DATA_DAYS = 14;
/** Доставка была раньше — «Доставлена» ставится без сообщения клиенту (старые строки из Excel, правило 9 задания). */
const NOTIFY_DELIVERED_DAYS = 3;
const MAX_EVENTS = 50;
const DAY = 24 * 60 * 60 * 1000;
const NOT_REGISTERED = -18019902;

const PROBLEM_STATUSES = new Set(["Exception", "DeliveryFailure", "Expired"]);
const PROBLEM_SUB_STATUSES = new Set(["InTransit_CustomsRequiringInformation"]);

export type TrackingEvent = { at: string | null; text: string; location: string | null };
export type SyncResult = { ok: boolean; message: string };

type Counters = { registered: number; updated: number; delivered: number; switched: number; errors: string[] };
/** extra — данные получателя на случай, если перевозчик их попросит. */
type Extra = { country: string | null; postalCode: string | null; phone: string | null; shippedAt: Date };
type Target = { parcelId: string; number: string; carrier?: number | null; extra?: Extra };
type Fallback = { carrier: number; name: string; prefixes: string[]; afterHours: number };
type Options = { lang: string; fallback: Fallback | null };
/** Номер, который пора переставить на запасного перевозчика. */
type Switch = { target: Target; carrierOld: number | null };

/** Отправлена недавно — встаёт на слежение сама; более старые — кнопкой в карточке, чтобы не тратить квоту на историю. */
export function shippedRecently(shippedAt: Date): boolean {
  return shippedAt.getTime() >= Date.now() - RECENT_DAYS * DAY;
}

/** Номер для слежения: без пробелов, заглавными. */
export function normalizeTrackNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export async function getTrackingKey(): Promise<string | null> {
  const settings = await prisma.trackingSettings.findFirst({ select: { apiKey: true } });
  return settings?.apiKey?.trim() || null;
}

async function loadOptions(): Promise<Options> {
  const s = await prisma.trackingSettings.findFirst({
    select: { lang: true, fallbackPrefixes: true, fallbackCarrier: true, fallbackCarrierName: true, fallbackAfterHours: true },
  });
  const prefixes = (s?.fallbackPrefixes ?? "").split(/[\s,;]+/).map((p) => p.trim().toUpperCase()).filter(Boolean);
  return {
    lang: s?.lang || "ru",
    fallback:
      s?.fallbackCarrier && prefixes.length
        ? { carrier: s.fallbackCarrier, name: s.fallbackCarrierName || `перевозчик ${s.fallbackCarrier}`, prefixes, afterHours: s.fallbackAfterHours }
        : null,
  };
}

const fallbackFits = (fallback: Fallback | null, number: string): fallback is Fallback =>
  Boolean(fallback?.prefixes.some((prefix) => number.startsWith(prefix)));

const pad = (n: number) => String(n).padStart(2, "0");

/** Данные получателя для перевозчиков, которые без них не показывают трек. */
function extraFields(extra: Extra | undefined): Partial<Track17RegisterItem> {
  if (!extra) return {};
  const digits = (extra.phone ?? "").replace(/\D/g, "");
  const d = extra.shippedAt;
  return {
    ...(extra.country ? { destination_country: extra.country } : {}),
    ...(extra.postalCode ? { destination_postal_code: extra.postalCode } : {}),
    ...(digits.length >= 4 ? { phone_number_last_4: digits.slice(-4) } : {}),
    ship_date: `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`,
  };
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

type Registration = { registeredAt: Date | null; carrier?: number | null; carrierName?: string | null; fallbackAt?: Date | null; error?: string; problem?: boolean };

/** Номер на слежение заново: прежнее состояние стирается. */
async function saveRegistration(target: Target, registration: Registration) {
  const data = {
    number: target.number,
    carrier: registration.carrier ?? null,
    carrierName: registration.carrierName ?? null,
    fallbackAt: registration.fallbackAt ?? null,
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

/**
 * Посылка «Отправлена» → «Доставлена» по данным 17TRACK. Повторный вызов ничего не делает.
 * Клиенту сообщаем, только если доставка свежая (не раньше NOTIFY_DELIVERED_DAYS дней назад).
 */
async function markDelivered(parcelId: string, note: string | null, deliveredAt: Date | null): Promise<boolean> {
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
  const fresh = !deliveredAt || Date.now() - deliveredAt.getTime() <= NOTIFY_DELIVERED_DAYS * DAY;
  if (fresh) await notifyParcelStatusChange(parcelId, "DELIVERED");
  return true;
}

async function applyInfo(target: Target, item: Track17Item, counters: Counters, opts: Options, switches: Switch[]) {
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

  const current = await prisma.parcelTracking.findUnique({
    where: { parcelId: target.parcelId },
    select: { registeredAt: true, fallbackAt: true },
  });
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
  if (status === "Delivered" && (await markDelivered(target.parcelId, eventText(latest), latest ? eventTime(latest) : null))) counters.delivered++;

  // Ничего не найдено за N часов, номер с приставкой запасного перевозчика — переставить на него (один раз).
  const fallback = opts.fallback;
  if (
    fallbackFits(fallback, target.number) &&
    (!status || status === "NotFound") &&
    !current?.fallbackAt &&
    item.carrier !== fallback.carrier &&
    current?.registeredAt &&
    Date.now() - current.registeredAt.getTime() >= fallback.afterHours * 60 * 60 * 1000
  ) {
    switches.push({ target, carrierOld: item.carrier ?? null });
  }
}

/** Переставить номера на запасного перевозчика: 17TRACK будет искать их у него (тратит 1 номер квоты на каждый). */
async function switchCarriers(key: string, switches: Switch[], fallback: Fallback, counters: Counters) {
  for (const chunk of chunks(switches, BATCH)) {
    const groups = byNumber(chunk.map((s) => s.target));
    const old = new Map(chunk.map((s) => [s.target.number, s.carrierOld]));
    const result = await changeCarrier(
      key,
      [...groups.keys()].map((number) => ({ number, ...(old.get(number) ? { carrier_old: old.get(number)! } : {}), carrier_new: fallback.carrier })),
    );
    for (const item of result.accepted) {
      for (const target of groups.get(item.number) ?? []) {
        await prisma.parcelTracking.update({
          where: { parcelId: target.parcelId },
          data: {
            carrier: fallback.carrier, carrierName: fallback.name, fallbackAt: new Date(),
            status: null, subStatus: null, event: null, location: null, eventAt: null, events: [], problem: false, error: null,
          },
        });
        counters.switched++;
      }
    }
    for (const item of result.rejected) {
      if (item.error?.code === CHANGE_TOO_EARLY) continue; // 17TRACK ещё ищет — попробуем при следующей проверке
      const message = `не удалось переставить на ${fallback.name}: ${item.error?.message || "ошибка 17TRACK"}`;
      for (const target of groups.get(item.number) ?? []) {
        await prisma.parcelTracking.update({ where: { parcelId: target.parcelId }, data: { fallbackAt: new Date(), error: message } });
      }
      counters.errors.push(`${item.number}: ${message}`);
    }
  }
}

async function registerTargets(key: string, targets: Target[], counters: Counters, opts: Options): Promise<Target[]> {
  const registered: Target[] = [];
  const accept = async (target: Target, carrier: number | null | undefined, fallback: boolean) => {
    await saveRegistration(target, {
      registeredAt: new Date(),
      carrier,
      ...(fallback && opts.fallback ? { carrierName: opts.fallback.name, fallbackAt: new Date() } : {}),
    });
    registered.push({ ...target, carrier: carrier ?? null });
    counters.registered++;
    if (fallback) counters.switched++;
  };
  const reject = async (target: Target, item: Track17Item) => {
    if (item.error?.code === ALREADY_REGISTERED) {
      await saveRegistration(target, { registeredAt: new Date() });
      registered.push(target);
      return;
    }
    const message = item.error?.message || "не удалось поставить на слежение";
    // нет квоты — общая беда, а не этого номера: проблемой посылку не помечаем
    await saveRegistration(target, { registeredAt: null, error: message, problem: item.error?.code !== QUOTA_RAN_OUT });
    counters.errors.push(`${item.number}: ${message}`);
  };

  // Второй заход: перевозчик просит данные получателя или 17TRACK не определил перевозчика, а у номера есть запасной.
  const retry: { item: Track17RegisterItem; targets: Target[]; fallback: boolean }[] = [];
  for (const chunk of chunks(targets, BATCH)) {
    const groups = byNumber(chunk);
    const result = await register(key, [...groups.keys()].map((number) => ({ number, lang: opts.lang })));
    for (const item of result.accepted) {
      for (const target of groups.get(item.number) ?? []) await accept(target, item.carrier, false);
    }
    for (const item of result.rejected) {
      const group = groups.get(item.number) ?? [];
      const code = item.error?.code ?? 0;
      if (NEEDS_EXTRA_INFO.has(code) && group[0]?.extra) {
        retry.push({ item: { number: item.number, lang: opts.lang, ...extraFields(group[0].extra) }, targets: group, fallback: false });
      } else if (code === CARRIER_NOT_DETECTED && fallbackFits(opts.fallback, item.number)) {
        retry.push({ item: { number: item.number, lang: opts.lang, carrier: opts.fallback.carrier }, targets: group, fallback: true });
      } else {
        for (const target of group) await reject(target, item);
      }
    }
  }
  for (const chunk of chunks(retry, BATCH)) {
    const byNum = new Map(chunk.map((r) => [r.item.number, r]));
    const result = await register(key, chunk.map((r) => r.item));
    for (const item of result.accepted) {
      const entry = byNum.get(item.number);
      for (const target of entry?.targets ?? []) await accept(target, item.carrier, Boolean(entry?.fallback));
    }
    for (const item of result.rejected) {
      for (const target of byNum.get(item.number)?.targets ?? []) await reject(target, item);
    }
  }
  return registered;
}

async function fetchTargets(key: string, targets: Target[], counters: Counters, opts: Options, switches: Switch[]) {
  for (const chunk of chunks(targets, BATCH)) {
    const groups = byNumber(chunk);
    const result = await getTrackInfo(key, [...groups.values()].map((group) => group[0]));
    for (const item of result.accepted) {
      for (const target of groups.get(item.number) ?? []) await applyInfo(target, item, counters, opts, switches);
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

const PROBLEM_WHERE = { problem: true, parcel: { status: "SHIPPED", deletedAt: null } } satisfies Prisma.ParcelTrackingWhereInput;
const OWNER_LIST_MAX = 15;

/**
 * Оповещение владельцу по итогу проверки — одним сообщением и только о посылках, которые стали «требуют внимания»
 * с прошлой проверки (иначе раз в 2 часа приходило бы одно и то же).
 */
async function notifyNewProblems(before: Set<string>, total: number) {
  const fresh = (
    await prisma.parcelTracking.findMany({
      where: PROBLEM_WHERE,
      select: {
        parcelId: true, status: true, subStatus: true, error: true, registeredAt: true,
        parcel: { select: { number: true, trackingNumber: true, parcelTask: { select: { number: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    })
  ).filter((t) => !before.has(t.parcelId));
  if (!fresh.length) return;
  const lines = fresh.slice(0, OWNER_LIST_MAX).map((t) => {
    const what = t.registeredAt ? trackingStatusLabel(t.status, t.subStatus) : t.error || "номер не принят";
    return `• ${[t.parcel.number, t.parcel.parcelTask?.number, t.parcel.trackingNumber].filter(Boolean).join(" · ")} — ${what}`;
  });
  if (fresh.length > OWNER_LIST_MAX) lines.push(`…и ещё ${fresh.length - OWNER_LIST_MAX}`);
  const app = process.env.NEXT_PUBLIC_APP_URL;
  await notifyOwner(
    [
      `⚠️ Отслеживание: ${fresh.length === 1 ? "посылка требует" : `посылок требуют — ${fresh.length},`} внимания`,
      ...lines,
      `Всего требуют внимания: ${total}.${app ? ` Список: ${app}/parcels?tracking=problem` : ""}`,
    ].join("\n"),
  );
}

/**
 * Проверить посылки в 17TRACK. Без parcelIds — все «Отправленные» с трек-номером (по расписанию и из настроек),
 * итог пишется в настройки. С parcelIds — эти посылки в любом статусе и любой давности (кнопка в карточке).
 */
export async function syncTracking({ parcelIds }: { parcelIds?: string[] } = {}): Promise<SyncResult> {
  const all = !parcelIds;
  const key = await getTrackingKey();
  if (!key) return { ok: false, message: "Ключ 17TRACK не задан — «Настройки» → «Отслеживание посылок»" };
  // что уже «требует внимания» — владельцу сообщаем только о новом (проверка всех посылок)
  const before = all
    ? new Set((await prisma.parcelTracking.findMany({ where: PROBLEM_WHERE, select: { parcelId: true } })).map((t) => t.parcelId))
    : null;

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
      recipient: { select: { countryCode: true, postalCode: true, phone: true } },
      statusHistory: { where: { status: "SHIPPED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  const toRegister: Target[] = [];
  const toFetch: Target[] = [];
  let tooOld = 0;
  for (const parcel of parcels) {
    const number = normalizeTrackNumber(parcel.trackingNumber ?? "");
    if (!number) continue;
    const tracking = parcel.tracking;
    if (tracking?.number === number && tracking.registeredAt) {
      toFetch.push({ parcelId: parcel.id, number, carrier: tracking.carrier });
      continue;
    }
    const shippedAt = parcel.statusHistory[0]?.createdAt ?? parcel.updatedAt;
    if (all && !shippedRecently(shippedAt)) {
      tooOld++;
      continue;
    }
    const r = parcel.recipient;
    toRegister.push({
      parcelId: parcel.id,
      number,
      extra: { country: r?.countryCode ?? null, postalCode: r?.postalCode ?? null, phone: r?.phone ?? null, shippedAt },
    });
  }

  const opts = await loadOptions();
  const counters: Counters = { registered: 0, updated: 0, delivered: 0, switched: 0, errors: [] };
  const switches: Switch[] = [];
  let failure: string | null = null;
  try {
    toFetch.push(...(await registerTargets(key, toRegister, counters, opts)));
    await fetchTargets(key, toFetch, counters, opts, switches);
    if (switches.length && opts.fallback) await switchCarriers(key, switches, opts.fallback, counters);
  } catch (error) {
    if (!(error instanceof Track17RequestError)) throw error;
    failure = error.message;
  }

  const problems = await prisma.parcelTracking.count({ where: PROBLEM_WHERE });
  if (before) await notifyNewProblems(before, problems);
  const parts = [
    `поставлено на слежение ${counters.registered}`,
    `обновлено ${counters.updated}`,
    `доставлено ${counters.delivered}`,
    `требуют внимания ${problems}`,
  ];
  if (counters.switched) parts.push(`переставлено на ${opts.fallback?.name ?? "запасного перевозчика"} ${counters.switched}`);
  if (counters.errors.length) parts.push(`ошибок по номерам ${counters.errors.length} (${counters.errors.slice(0, 3).join("; ")})`);
  if (all) {
    // Почему посылка «Отправлена», а на слежение не встала
    const noNumber = await prisma.parcel.count({ where: { deletedAt: null, status: "SHIPPED", trackingNumber: null } });
    if (tooOld) parts.push(`отправлены больше ${RECENT_DAYS} дней назад и сами не ставятся — ${tooOld} (поставить: кнопка в карточке; дошедшие — отметить «Доставлена»)`);
    if (noNumber) parts.push(`«Отправлена» без трек-номера — ${noNumber}`);
  }
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
