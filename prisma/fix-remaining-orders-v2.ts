import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORDER_ROUTE_PATTERN = /^([A-Z]{1,6}?)(\d+)([A-Z]{2,4})(?=$|[^A-Z0-9])/i;

const COUNTRY_MAP: Record<string, string> = {
  China: "CN",
  Cyprus: "CY",
  Estonia: "EE",
  Italy: "IT",
  USA: "US",
  UAE: "AE",
  Dubai: "AE",
  Russia: "RU",
  "Россия": "RU",
  Украина: "UA",
  Україна: "UA",
  Ukraine: "UA",
  Kazakhstan: "KZ",
  Uzbekistan: "UZ",
  Poland: "PL",
  Польша: "PL",
  Belarus: "BY",
  Беларусь: "BY",
  Lithuania: "LT",
  Латвия: "LV",
  Latvia: "LV",
  Germany: "DE",
  France: "FR",
  Israel: "IL",
  Канада: "CA",
  Canada: "CA",
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

// Find country code and its position in text
function findCountry(text: string): { code: string; index: number } | null {
  let best: { code: string; index: number } | null = null;
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    const re = new RegExp(`\\b${name}\\b`, "iu");
    const match = re.exec(text);
    if (match && match.index !== undefined) {
      if (!best || match.index < best.index) best = { code, index: match.index };
    }
  }
  return best;
}

// Find personal-name-looking sequences (Latin and Cyrillic, with apostrophes & hyphens)
function findNames(text: string): { name: string; index: number }[] {
  const pattern =
    /([A-ZА-ЯЁ][a-zа-яё'’\-]+(?:\s+[A-ZА-ЯЁ][a-zа-яё'’\-]+){1,3})/gu;
  const out: { name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const name = m[1].trim();
    // skip noise like "Country name:", "Full address", "Zip-code", words after digits like "Куртка"
    if (/(Country|Full|Address|Zip|Phone|City|Street|Apt|Vid|Track|Вид|Получатель|Номер|Трек|Доставка|Наименование|Стоимость|Новая Почта|Wellington|Soho Residence|Florio|Architecture|Yangi Amir)/i.test(name)) continue;
    out.push({ name, index: m.index });
  }
  return out;
}

function extractRecipient(text: string): { name: string; country: string } | null {
  const country = findCountry(text);
  if (!country) return null;
  const names = findNames(text);
  if (names.length === 0) return null;

  // Pick the name closest BEFORE the country marker (within 200 chars)
  let best: { name: string; index: number } | null = null;
  for (const n of names) {
    if (n.index > country.index) continue;
    if (country.index - n.index > 200) continue;
    if (!best || n.index > best.index) best = n;
  }
  // If no name before, fall back to name after (within 60 chars)
  if (!best) {
    for (const n of names) {
      if (n.index < country.index) continue;
      if (n.index - country.index > 60) continue;
      if (!best || n.index < best.index) best = n;
    }
  }
  if (!best) return null;
  return { name: best.name, country: country.code };
}

async function process(): Promise<void> {
  const orphans = await prisma.order.findMany({
    where: { deletedAt: null, customerId: null },
    select: { id: true, sku: true, description: true, name: true },
  });

  let updatedFromDesc = 0;
  let createdCustomers = 0;
  const details: string[] = [];

  for (const o of orphans) {
    if (parseRoute(o.sku)) continue;
    const desc = (o.description ?? "") + "\n" + (o.name ?? "");
    const r = extractRecipient(desc);
    if (!r) {
      details.push(`  ${o.sku.padEnd(28)} → unable to parse`);
      continue;
    }
    // Heuristic: discard Chinese-warehouse names like "Natia Gigolashvili 广东..."
    // by checking if Chinese chars appear right after the name in the original text
    const cnRe = new RegExp(`${r.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+[\\p{Script=Han}]`, "u");
    if (cnRe.test(desc) && r.country !== "CN") {
      details.push(`  ${o.sku.padEnd(28)} → "${r.name}" looks like Chinese warehouse, skip`);
      continue;
    }

    // Find existing customer
    const matches = await prisma.customer.findMany({
      where: { deletedAt: null, name: { contains: r.name } },
      select: { id: true, name: true },
    });
    let customerId: string | null = null;
    if (matches.length >= 1) {
      const exact = matches.find((m) => m.name.toLowerCase() === r.name.toLowerCase());
      customerId = (exact ?? matches[0]).id;
      details.push(`  ${o.sku.padEnd(28)} → linked existing "${(exact ?? matches[0]).name}" (${r.country})`);
    } else {
      const created = await prisma.customer.create({
        data: { name: r.name, country: r.country, countryCode: r.country },
        select: { id: true },
      });
      customerId = created.id;
      createdCustomers++;
      details.push(`  ${o.sku.padEnd(28)} → CREATED "${r.name}" (${r.country})`);
    }
    await prisma.order.update({ where: { id: o.id }, data: { customerId } });
    updatedFromDesc++;
  }

  console.log(`Linked from description: ${updatedFromDesc}  Created new customers: ${createdCustomers}`);
  for (const d of details) console.log(d);

  // Final renumber pass
  console.log("\n== Final renumber ==");
  const allOrders = await prisma.order.findMany({
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
  const renamedDetails: string[] = [];

  for (const o of allOrders) {
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
    if (renamedDetails.length < 30) renamedDetails.push(`  ${o.sku.padEnd(28)} → ${candidate}`);
    renamed++;
    serial++;
  }
  console.log(`Renamed: ${renamed}  Skipped already-correct or unresolvable: ${skipped}`);
  for (const d of renamedDetails) console.log(d);

  // Final state
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
  console.log(`\nActive: ${all.length}  Correct: ${correct}  Wrong: ${wrong}`);
}

process()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("ERROR:", e);
    prisma.$disconnect();
    process.exit(1);
  });
