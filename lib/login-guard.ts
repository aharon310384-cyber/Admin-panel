import "server-only";

/**
 * Блокировка входа после серии неудачных попыток — по учётной записи, а не по IP
 * (лимит по IP в nginx обходится ботнетом). Счётчик ведётся по введённому логину
 * независимо от того, существует ли такой аккаунт, — так блокировка не выдаёт,
 * какие логины настоящие.
 *
 * Хранилище — в памяти процесса: приложение работает одним процессом (PM2 fork).
 * После перезапуска счётчики обнуляются — это допустимо.
 */

const MAX_FAILURES = 5; // неудачных попыток подряд…
const WINDOW_MS = 15 * 60 * 1000; // …в пределах 15 минут
const LOCK_MS = 15 * 60 * 1000; // → блокировка на 15 минут
const MAX_ENTRIES = 10_000; // защита от раздувания памяти мусорными логинами

type Entry = { failures: number; firstAt: number; lockedUntil: number };

const g = globalThis as unknown as { __loginGuard?: Map<string, Entry> };
const store = (g.__loginGuard ??= new Map<string, Entry>());

export type LoginScope = "admin" | "client";

function key(scope: LoginScope, login: string): string {
  return `${scope}:${login.trim().toLowerCase()}`;
}

function prune(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [k, e] of store) {
    if (e.lockedUntil <= now && now - e.firstAt > WINDOW_MS) store.delete(k);
  }
  // Если всё ещё переполнено (массовая атака) — выкидываем самые старые записи.
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** Сколько мс ещё действует блокировка (0 — вход разрешён). */
export function lockRemainingMs(scope: LoginScope, login: string): number {
  const e = store.get(key(scope, login));
  if (!e) return 0;
  return Math.max(0, e.lockedUntil - Date.now());
}

/** Учесть неудачную попытку. Возвращает true, если после неё аккаунт заблокирован. */
export function registerFailure(scope: LoginScope, login: string): boolean {
  const now = Date.now();
  const k = key(scope, login);
  let e = store.get(k);
  if (!e || now - e.firstAt > WINDOW_MS) {
    prune(now);
    e = { failures: 0, firstAt: now, lockedUntil: 0 };
  }
  e.failures += 1;
  if (e.failures >= MAX_FAILURES) {
    e.lockedUntil = now + LOCK_MS;
    e.failures = 0;
    e.firstAt = now;
  }
  store.set(k, e);
  return e.lockedUntil > now;
}

/** Успешный вход — сбросить счётчик. */
export function registerSuccess(scope: LoginScope, login: string): void {
  store.delete(key(scope, login));
}

/** «15 минут» / «1 минуту» — для сообщения пользователю. */
export function minutesText(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60000));
  const mod10 = m % 10;
  const mod100 = m % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "минуту"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "минуты"
        : "минут";
  return `${m} ${word}`;
}
