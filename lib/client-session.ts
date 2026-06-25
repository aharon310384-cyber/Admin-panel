import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";

/**
 * Лёгкая клиентская сессия кабинета — отдельная от админского NextAuth.
 * Подписанная httpOnly-cookie с id клиента (Customer). Используется для входа
 * клиента через Telegram. Подпись — HMAC-SHA256 на AUTH_SECRET.
 */

export const CLIENT_SESSION_COOKIE = "client-session";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 дней
const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

type ClientSessionPayload = {
  cid: string; // Customer.id
  via: "telegram";
  iat: number; // epoch seconds
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
}

export function createClientSessionToken(customerId: string): string {
  const payload: ClientSessionPayload = {
    cid: customerId,
    via: "telegram",
    iat: Math.floor(Date.now() / 1000),
  };
  const data = b64url(JSON.stringify(payload));
  return `${data}.${sign(data)}`;
}

export function verifyClientSessionToken(token: string | undefined): string | null {
  if (!token || !SECRET) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    ) as ClientSessionPayload;
    if (!payload.cid || payload.via !== "telegram") return null;
    if (Date.now() / 1000 - payload.iat > MAX_AGE_SECONDS) return null;
    return payload.cid;
  } catch {
    return null;
  }
}

/** Ставит cookie клиентской сессии (только из Route Handler / Server Action). */
export async function setClientSession(customerId: string): Promise<void> {
  const store = await cookies();
  store.set(CLIENT_SESSION_COOKIE, createClientSessionToken(customerId), {
    httpOnly: true,
    // secure отслеживает реальный протокол (как NextAuth), а не NODE_ENV:
    // на проде с HTTPS — true, на HTTP-тесте — false, иначе браузер не сохранит cookie.
    secure: (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Возвращает id клиента из валидной клиентской сессии или null. */
export async function getClientSessionCustomerId(): Promise<string | null> {
  const store = await cookies();
  return verifyClientSessionToken(store.get(CLIENT_SESSION_COOKIE)?.value);
}

/** Удаляет cookie клиентской сессии (Route Handler / Server Action). */
export async function clearClientSession(): Promise<void> {
  const store = await cookies();
  store.delete(CLIENT_SESSION_COOKIE);
}
