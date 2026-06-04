import "server-only";

import type { Customer } from "@prisma/client";
import type { Session } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const CLIENT_CABINET_COOKIE_NAME = "client-cabinet-customer-id";
export const CLIENT_CABINET_ROUTE = "/cabinet";

const clientIdSchema = z.string().trim().cuid();

export type ClientCabinetAdminSession = Session & {
  user: Session["user"] & { role: "ADMIN" };
};

export type ClientCabinetClient = Omit<Customer, "code"> & {
  code: string;
};

export type ClientCabinetContext = {
  session: ClientCabinetAdminSession;
  client: ClientCabinetClient;
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
  };
}

export async function getClientCabinetContext(): Promise<ClientCabinetContext> {
  const cookieStore = await cookies();
  const clientId = cookieStore.get(CLIENT_CABINET_COOKIE_NAME)?.value;

  return requireClientCabinetAccess(clientId);
}
