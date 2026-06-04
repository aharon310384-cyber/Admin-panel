import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORDER_ROUTE_PATTERN = /^([A-Z]{1,6}?)(\d+)([A-Z]{2,4})(?=$|[^A-Z0-9])/i;
const POSITION_PATTERN = /Позиция\s+([A-Z]{1,6})(\d+)([A-Z]{2,4})/i;
// Recognize country names in description
const COUNTRY_MAP: Record<string, string> = {
  China: "CN", Cyprus: "CY", Estonia: "EE", Italy: "IT", USA: "US",
  UAE: "AE", Dubai: "AE",
  Russia: "RU", "Россия": "RU", "Украина": "UA",
  Kazakhstan: "KZ", Uzbekistan: "UZ", Poland: "PL", "Польша": "PL",
};

function parseRoute(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  const match = normalized.match(ORDER_ROUTE_PATTERN);
  return match ? { prefix: match[1], number: match[2], country: match[3] } : null;
}

async function nextSerial(): Promise<number> {
  const [parcels, orders] = await Promise.all([
    prisma.parcel.findMany({ where: { routeNumber: { not: null } }, select: { routeNumber: true } }),
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

function detectCountryFromDescription(desc: string): string | null {
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(desc)) return code;
  }
  return null;
}

// Extract a plausible recipient name from the description
function extractRecipientName(desc: string): string | null {
  // Heuristic: latin name 2-3 words right after the price/track noise
  // Pattern like "Куртка - 200 ю Klenko Elena Russia" - the name is between price and country
  const namePattern = /(?:[¥юд$]\s*|чёрная сумка\s*)(?:#?\d+(?:[-А-я]+)?\s*)*([A-ZА-Я][a-zа-я'\-]+(?:\s+[A-ZА-Я][a-zа-я'\-]+){1,2})\s+(?:China|Cyprus|Estonia|Italy|USA|UAE|Dubai|Russia|Україна|Украина|Kazakhstan|Uzbekistan|Poland|Россия|Польша)/u;
  const match = desc.match(namePattern);
  return match ? match[1].trim() : null;
}

async function fixGroupD(): Promise<{ updated: number; details: string[] }> {
  // For Group D (customer has clientCode but no countryCode) — pull countryCode from related parcels
  const orphanOrders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      customer: { countryCode: null },
    },
    select: {
      id: true,
      customer: { select: { id: true, name: true, clientCode: true, code: true, countryCode: true } },
      parcelItems: { select: { parcel: { select: { routeCountry: true } } } },
    },
  });

  const updates = new Map<string, { name: string; country: string }>();
  for (const o of orphanOrders) {
    if (!o.customer || o.customer.countryCode) continue;
    if (updates.has(o.customer.id)) continue;
    const country = o.parcelItems.find((pi) => pi.parcel.routeCountry)?.parcel.routeCountry;
    if (country) updates.set(o.customer.id, { name: o.customer.name, country });
  }

  const details: string[] = [];
  for (const [cid, info] of updates) {
    await prisma.customer.update({ where: { id: cid }, data: { countryCode: info.country } });
    details.push(`  Customer ${info.name} → countryCode=${info.country}`);
  }
  return { updated: updates.size, details };
}

async function fixCategory2(serialRef: { value: number }): Promise<{ renamed: number; details: string[] }> {
  const orders = await prisma.order.findMany({
    where: { deletedAt: null },
    select: { id: true, sku: true, name: true },
  });

  const details: string[] = [];
  let renamed = 0;
  for (const o of orders) {
    if (parseRoute(o.sku)) continue;
    if (!o.name) continue;
    const m = o.name.match(POSITION_PATTERN);
    if (!m) continue;
    const candidate = `${m[1].toUpperCase()}${m[2]}${m[3].toUpperCase()}`;
    const taken = await prisma.order.findFirst({
      where: { sku: candidate, NOT: { id: o.id } },
      select: { id: true },
    });
    if (taken) {
      details.push(`  ${o.sku} → ${candidate} SKIPPED (taken)`);
      continue;
    }
    await prisma.order.update({ where: { id: o.id }, data: { sku: candidate } });
    details.push(`  ${o.sku} → ${candidate} (from name)`);
    renamed++;
  }
  void serialRef; // not used here (uses extracted number from name)
  return { renamed, details };
}

async function fixCategory1(): Promise<{ updated: number; created: number; details: string[] }> {
  // Try to extract recipient name + country from description and link to existing customer
  const orphans = await prisma.order.findMany({
    where: { deletedAt: null, customerId: null },
    select: { id: true, sku: true, description: true },
  });

  let updated = 0;
  let created = 0;
  const details: string[] = [];

  for (const o of orphans) {
    if (parseRoute(o.sku)) continue;
    const desc = o.description ?? "";
    if (!desc) continue;
    const name = extractRecipientName(desc);
    const country = detectCountryFromDescription(desc);
    if (!name || !country) {
      details.push(`  ${o.sku} → unable to parse (name="${name}" country="${country}")`);
      continue;
    }

    // Try to find existing customer by name match (case insensitive)
    const matches = await prisma.customer.findMany({
      where: { deletedAt: null, name: { contains: name } },
      select: { id: true, name: true, countryCode: true, clientCode: true, code: true },
    });

    let customerId: string | null = null;
    if (matches.length === 1) {
      customerId = matches[0].id;
      details.push(`  ${o.sku} → linked to existing "${matches[0].name}" (country=${country})`);
    } else if (matches.length > 1) {
      const exact = matches.find((m) => m.name.toLowerCase() === name.toLowerCase());
      if (exact) {
        customerId = exact.id;
        details.push(`  ${o.sku} → linked to exact-match "${exact.name}"`);
      } else {
        details.push(`  ${o.sku} → ${matches.length} matches for "${name}", skipping`);
      }
    } else {
      // create new customer
      const newCustomer = await prisma.customer.create({
        data: {
          name,
          countryCode: country,
          country,
        },
        select: { id: true },
      });
      customerId = newCustomer.id;
      created++;
      details.push(`  ${o.sku} → CREATED new customer "${name}" (country=${country})`);
    }

    if (customerId) {
      await prisma.order.update({ where: { id: o.id }, data: { customerId } });
      updated++;
    }
  }

  return { updated, created, details };
}

async function renumberRemaining(): Promise<{ renamed: number; skipped: number; details: string[] }> {
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
    while (
      await prisma.order.findFirst({
        where: { sku: candidate, NOT: { id: o.id } },
        select: { id: true },
      })
    ) {
      serial++;
      candidate = `${clientCode}${serial}${countryCode}`;
    }

    await prisma.order.update({ where: { id: o.id }, data: { sku: candidate } });
    if (details.length < 30) details.push(`  ${o.sku.padEnd(28)} → ${candidate}`);
    renamed++;
    serial++;
  }

  return { renamed, skipped, details };
}

async function main() {
  console.log("== Step 1: backfill missing countryCode in customers from related parcels ==");
  const groupD = await fixGroupD();
  console.log(`Updated customers: ${groupD.updated}`);
  for (const d of groupD.details) console.log(d);

  console.log("\n== Step 2: rename orders whose name contains 'Позиция XX####CN' ==");
  const serialRef = { value: 0 };
  const cat2 = await fixCategory2(serialRef);
  console.log(`Renamed: ${cat2.renamed}`);
  for (const d of cat2.details) console.log(d);

  console.log("\n== Step 3: parse description, match/create customer ==");
  const cat1 = await fixCategory1();
  console.log(`Orders linked to customers: ${cat1.updated}  (new customers created: ${cat1.created})`);
  for (const d of cat1.details) console.log(d);

  console.log("\n== Step 4: final renumber pass ==");
  const finalPass = await renumberRemaining();
  console.log(`Renamed: ${finalPass.renamed}  Skipped: ${finalPass.skipped}`);
  for (const d of finalPass.details) console.log(d);

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
