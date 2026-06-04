import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORDER_ROUTE_PATTERN = /^([A-Z]{1,6}?)(\d+)([A-Z]{2,4})(?=$|[^A-Z0-9])/i;

function parseRoute(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  const match = normalized.match(ORDER_ROUTE_PATTERN);
  if (!match) return null;
  return { prefix: match[1], number: match[2], country: match[3] };
}

async function nextSerial(): Promise<number> {
  const [parcels, orders] = await Promise.all([
    prisma.parcel.findMany({
      where: { routeNumber: { not: null } },
      select: { routeNumber: true },
    }),
    prisma.order.findMany({ select: { sku: true } }),
  ]);
  let max = 0;
  for (const p of parcels) {
    const n = Number.parseInt(p.routeNumber ?? "", 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  for (const o of orders) {
    const parsed = parseRoute(o.sku);
    if (!parsed) continue;
    const n = Number.parseInt(parsed.number, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

async function backfillCustomerFromParcels(): Promise<number> {
  const orphans = await prisma.order.findMany({
    where: { customerId: null, deletedAt: null },
    select: {
      id: true,
      parcelItems: {
        select: { parcel: { select: { customerId: true } } },
      },
    },
  });

  let linked = 0;
  for (const o of orphans) {
    const customerIds = o.parcelItems
      .map((pi) => pi.parcel.customerId)
      .filter((id): id is string => Boolean(id));
    if (customerIds.length === 0) continue;

    const counts = new Map<string, number>();
    for (const cid of customerIds) counts.set(cid, (counts.get(cid) ?? 0) + 1);
    let bestId = "";
    let bestCount = 0;
    for (const [cid, c] of counts) {
      if (c > bestCount) {
        bestCount = c;
        bestId = cid;
      }
    }

    await prisma.order.update({
      where: { id: o.id },
      data: { customerId: bestId },
    });
    linked++;
  }

  return linked;
}

async function isSkuTaken(sku: string, excludeId: string): Promise<boolean> {
  const existing = await prisma.order.findFirst({
    where: { sku, NOT: { id: excludeId } },
    select: { id: true },
  });
  return Boolean(existing);
}

async function renumber(): Promise<{ renamed: number; skipped: number; details: string[] }> {
  const orders = await prisma.order.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      sku: true,
      customer: { select: { code: true, clientCode: true, countryCode: true } },
    },
  });

  let serial = await nextSerial();
  let renamed = 0;
  let skipped = 0;
  const details: string[] = [];

  for (const o of orders) {
    if (parseRoute(o.sku)) {
      skipped++;
      continue;
    }
    if (!o.customer) {
      skipped++;
      continue;
    }
    const clientCode = (o.customer.clientCode ?? o.customer.code ?? "").trim().toUpperCase();
    const countryCode = (o.customer.countryCode ?? "").trim().toUpperCase();
    if (!clientCode || !countryCode) {
      skipped++;
      continue;
    }

    let candidate = `${clientCode}${serial}${countryCode}`;
    while (await isSkuTaken(candidate, o.id)) {
      serial++;
      candidate = `${clientCode}${serial}${countryCode}`;
    }

    await prisma.order.update({
      where: { id: o.id },
      data: { sku: candidate },
    });

    if (details.length < 10) details.push(`${o.sku.padEnd(28)} → ${candidate}`);
    renamed++;
    serial++;
  }

  return { renamed, skipped, details };
}

async function main() {
  console.log("== Step 1: backfill Order.customerId from ParcelItem ==");
  const linked = await backfillCustomerFromParcels();
  console.log(`Linked orders to customers via parcels: ${linked}`);

  console.log("\n== Step 2: renumber orders ==");
  const result = await renumber();
  console.log(`Renamed:  ${result.renamed}`);
  console.log(`Skipped:  ${result.skipped}`);
  console.log("\nSample renames:");
  for (const d of result.details) console.log(`  ${d}`);

  console.log("\n== Final state ==");
  const all = await prisma.order.findMany({
    where: { deletedAt: null },
    select: { sku: true },
  });
  let correct = 0;
  let wrong = 0;
  for (const o of all) {
    if (parseRoute(o.sku)) correct++;
    else wrong++;
  }
  console.log(`Active orders total:     ${all.length}`);
  console.log(`In correct format:       ${correct}`);
  console.log(`Still in wrong format:   ${wrong}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("ERROR:", e);
    prisma.$disconnect();
    process.exit(1);
  });
