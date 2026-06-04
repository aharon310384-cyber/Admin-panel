import "server-only";

import { prisma } from "@/lib/prisma";

export type ParsedOrderRoute = {
  routePrefix: string;
  routeNumber: string;
  routeCountry: string;
};

const ORDER_ROUTE_PATTERN = /^([A-Z]{1,6}?)(\d+)([A-Z]{2,4})(?=$|[^A-Z0-9])/i;

export function parseOrderRoute(value: string | null | undefined): ParsedOrderRoute | null {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;

  const match = normalized.match(ORDER_ROUTE_PATTERN);
  if (!match) return null;

  return {
    routePrefix: match[1],
    routeNumber: match[2],
    routeCountry: match[3],
  };
}

export type OrderNumberRecipient = {
  id: string;
  clientCode: string | null;
  code: string | null;
  countryCode: string | null;
};

export type OrderNumberParts = {
  clientCode: string;
  routeNumber: number;
  countryCode: string;
  number: string;
};

export type OrderNumberResolution =
  | { ok: true; parts: OrderNumberParts; recipient: OrderNumberRecipient }
  | { ok: false; missing: string[]; recipient: OrderNumberRecipient | null };

export async function nextOrderSerial(): Promise<number> {
  const [parcels, orders] = await Promise.all([
    prisma.parcel.findMany({
      where: { routeNumber: { not: null } },
      select: { routeNumber: true },
    }),
    prisma.order.findMany({
      select: { sku: true },
    }),
  ]);

  let max = 0;

  for (const row of parcels) {
    const n = Number.parseInt(row.routeNumber ?? "", 10);
    if (Number.isFinite(n) && n > max) max = n;
  }

  for (const row of orders) {
    const parsed = parseOrderRoute(row.sku);
    if (!parsed) continue;
    const n = Number.parseInt(parsed.routeNumber, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }

  return max + 1;
}

export function buildOrderNumber(
  clientCode: string,
  routeNumber: number,
  countryCode: string
): string {
  return `${clientCode}${routeNumber}${countryCode}`;
}

export async function resolveOrderNumber(customerId: string): Promise<OrderNumberResolution> {
  const recipient = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null },
    select: { id: true, code: true, clientCode: true, countryCode: true },
  });

  if (!recipient) {
    return { ok: false, missing: ["получатель"], recipient: null };
  }

  const clientCode = (recipient.clientCode ?? recipient.code ?? "").trim().toUpperCase();
  const countryCode = (recipient.countryCode ?? "").trim().toUpperCase();
  const missing: string[] = [];
  if (!clientCode) missing.push("код клиента");
  if (!countryCode) missing.push("код страны");

  if (missing.length > 0) {
    return { ok: false, missing, recipient };
  }

  const routeNumber = await nextOrderSerial();
  const number = buildOrderNumber(clientCode, routeNumber, countryCode);

  return {
    ok: true,
    parts: { clientCode, routeNumber, countryCode, number },
    recipient,
  };
}
