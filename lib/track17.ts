import "server-only";

// Клиент API 17TRACK (v2.4): ставим номера на слежение и забираем их состояние.
// Ключ — в заголовке 17token. Квота тратится только на постановку номера (1 номер = 1), проверка состояния бесплатна.
// Лимит — 3 запроса в секунду и до 40 номеров в запросе. TRACK17_API_URL подменяет адрес (проверка на заглушке).

const BASE = process.env.TRACK17_API_URL || "https://api.17track.net/track/v2.4";
const PAUSE_MS = 350;

export const BATCH = 40;
/** Номер уже стоит на слежении — квота не тратится, считаем поставленным. */
export const ALREADY_REGISTERED = -18019901;
/** Квота закончилась. */
export const QUOTA_RAN_OUT = -18019908;

export type Track17Error = { code: number; message: string };
export type Track17Event = {
  time_iso?: string | null;
  time_utc?: string | null;
  description?: string | null;
  description_translation?: { description?: string | null } | null;
  location?: string | null;
};
export type Track17Info = {
  latest_status?: { status?: string | null; sub_status?: string | null } | null;
  latest_event?: Track17Event | null;
  tracking?: { providers?: { provider?: { key?: number; name?: string | null } | null; events?: Track17Event[] | null }[] | null } | null;
};
export type Track17Item = { number: string; carrier?: number; error?: Track17Error; track_info?: Track17Info | null };
export type Track17Batch = { accepted: Track17Item[]; rejected: Track17Item[] };
export type Track17Quota = { quota_total: number; quota_used: number; quota_remain: number };

/** Запрос к 17TRACK не прошёл целиком: нет связи, неверный ключ, лимит. Текст — для людей. */
export class Track17RequestError extends Error {}

let lastCall = 0;

async function call<T>(key: string, path: string, body: unknown): Promise<T> {
  const wait = lastCall + PAUSE_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch {
    throw new Track17RequestError("17TRACK не отвечает");
  }
  const json = (await res.json().catch(() => null)) as { code?: number; data?: T & { errors?: Track17Error[] } } | null;
  if (res.status === 401) throw new Track17RequestError("17TRACK не принял ключ — проверьте его в настройках");
  if (res.status === 429) throw new Track17RequestError("17TRACK: слишком частые запросы, повторите позже");
  if (!res.ok || !json || json.code !== 0) {
    const reason = json?.data?.errors?.[0]?.message ?? `ошибка ${json?.code ?? res.status}`;
    throw new Track17RequestError(`17TRACK: ${reason}`);
  }
  return json.data as T;
}

function batch(data: Partial<Track17Batch> | undefined): Track17Batch {
  return { accepted: data?.accepted ?? [], rejected: data?.rejected ?? [] };
}

/** Поставить номера на слежение (до 40). Перевозчика 17TRACK определяет сам. */
export async function register(key: string, numbers: string[]): Promise<Track17Batch> {
  return batch(await call<Track17Batch>(key, "/register", numbers.map((number) => ({ number }))));
}

/** Состояние номеров, стоящих на слежении (до 40). */
export async function getTrackInfo(key: string, items: { number: string; carrier?: number | null }[]): Promise<Track17Batch> {
  const body = items.map(({ number, carrier }) => (carrier ? { number, carrier } : { number }));
  return batch(await call<Track17Batch>(key, "/gettrackinfo", body));
}

/** Квота: сколько номеров ещё можно поставить. Заодно проверка ключа. */
export async function getQuota(key: string): Promise<Track17Quota> {
  return call<Track17Quota>(key, "/getquota", []);
}
