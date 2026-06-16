import "server-only";

import type { Customer } from "@prisma/client";
import type { Session } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientSessionCustomerId } from "@/lib/client-session";

export const CLIENT_CABINET_COOKIE_NAME = "client-cabinet-customer-id";
export const CLIENT_CABINET_ROUTE = "/cabinet";

const clientIdSchema = z.string().trim().cuid();

export type ClientCabinetAdminSession = Session & {
  user: Session["user"] & { role: "ADMIN" };
};

export type ClientCabinetClient = Omit<Customer, "code"> & {
  code: string;
};

export type ClientCabinetMode = "admin" | "client";

export type ClientCabinetContext = {
  session: ClientCabinetAdminSession | null;
  client: ClientCabinetClient;
  mode: ClientCabinetMode;
};

export async function requireClientCabinetAdmin(): Promise<ClientCabinetAdminSession> {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return session as ClientCabinetAdminSession;
}

export async function requireClientCabinetAccess(
  clientId: string | null | undefined
): Promise<ClientCabinetContext> {
  const session = await requireClientCabinetAdmin();
  const parsedClientId = clientIdSchema.safeParse(clientId);

  if (!parsedClientId.success) {
    redirect("/clients");
  }

  const client = await prisma.customer.findFirst({
    where: {
      id: parsedClientId.data,
      deletedAt: null,
      code: { not: null },
    },
  });
  const code = client?.code?.trim();

  if (!client || !code) {
    redirect("/clients");
  }

  return {
    session,
    client: { ...client, code },
    mode: "admin",
  };
}

/**
 * Клиентский режим: вход через Telegram (cookie клиентской сессии).
 * Возвращает контекст без админ-сессии, либо null если сессии нет/клиент невалиден.
 */
async function getClientSessionContext(): Promise<ClientCabinetContext | null> {
  const customerId = await getClientSessionCustomerId();
  if (!customerId) return null;

  const client = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null, code: { not: null } },
  });
  const code = client?.code?.trim();
  if (!client || !code) return null;

  return {
    session: null,
    client: { ...client, code },
    mode: "client",
  };
}

export async function getClientCabinetContext(): Promise<ClientCabinetContext> {
  // 1. Клиент, вошедший через Telegram
  const clientCtx = await getClientSessionContext();
  if (clientCtx) return clientCtx;

  // 2. Админский режим «просмотр как клиент»
  const cookieStore = await cookies();
  const clientId = cookieStore.get(CLIENT_CABINET_COOKIE_NAME)?.value;

  return requireClientCabinetAccess(clientId);
}
