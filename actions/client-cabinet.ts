"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  CLIENT_CABINET_COOKIE_NAME,
  CLIENT_CABINET_ROUTE,
  requireClientCabinetAccess,
  requireClientCabinetAdmin,
} from "@/lib/client-cabinet";
import { clearClientSession } from "@/lib/client-session";

const clientCabinetCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: CLIENT_CABINET_ROUTE,
};

export async function enterClientCabinet(clientId: string): Promise<never> {
  const { client } = await requireClientCabinetAccess(clientId);
  const cookieStore = await cookies();

  cookieStore.set({
    name: CLIENT_CABINET_COOKIE_NAME,
    value: client.id,
    ...clientCabinetCookieOptions,
  });

  redirect(CLIENT_CABINET_ROUTE);
}

export async function exitClientCabinet(): Promise<never> {
  await requireClientCabinetAdmin();

  const cookieStore = await cookies();
  cookieStore.set({
    name: CLIENT_CABINET_COOKIE_NAME,
    value: "",
    ...clientCabinetCookieOptions,
    maxAge: 0,
  });

  redirect("/clients");
}

/** Выход клиента, вошедшего через Telegram/пароль (чистит клиентскую сессию). */
export async function clientLogout(): Promise<never> {
  await clearClientSession();
  redirect("/entrance");
}
