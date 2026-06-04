import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORDER_ROUTE_PATTERN = /^([A-Z]{1,6}?)(\d+)([A-Z]{2,4})(?=$|[^A-Z0-9])/i;

function parseOrderRoute(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  const match = normalized.match(ORDER_ROUTE_PATTERN);
  if (!match) return null;
  return { routePrefix: match[1], routeNumber: match[2], routeCountry: match[3] };
}

async function main() {
  const orders = await prisma.order.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      sku: true,
      customer: {
        select: { id: true, code: true, clientCode: true, countryCode: true },
      },
    },
  });

  let correct = 0;
  let wrongFormat = 0;
  let wrongFormatNoRecipient = 0;
  let wrongFormatRecipientIncomplete = 0;
  const samples: { sku: string; reason: string }[] = [];

  for (const o of orders) {
    const parsed = parseOrderRoute(o.sku);
    if (parsed) {
      correct++;
      continue;
    }
    wrongFormat++;

    if (!o.customer) {
      wrongFormatNoRecipient++;
      if (samples.length < 5) samples.push({ sku: o.sku, reason: "no customer" });
      continue;
    }

    const clientCode = (o.customer.clientCode ?? o.customer.code ?? "").trim();
    const countryCode = (o.customer.countryCode ?? "").trim();
    if (!clientCode || !countryCode) {
      wrongFormatRecipientIncomplete++;
      if (samples.length < 5)
        samples.push({
          sku: o.sku,
          reason: `incomplete recipient (clientCode="${clientCode}", countryCode="${countryCode}")`,
        });
    } else {
      if (samples.length < 5)
        samples.push({
          sku: o.sku,
          reason: `OK: → ${clientCode}<N>${countryCode}`,
        });
    }
  }

  const renamable = wrongFormat - wrongFormatNoRecipient - wrongFormatRecipientIncomplete;

  console.log("=== Order.sku inspection ===");
  console.log(`Total active orders:                ${orders.length}`);
  console.log(`Already in correct format:          ${correct}`);
  console.log(`Wrong format, total:                ${wrongFormat}`);
  console.log(`  - no customer linked:             ${wrongFormatNoRecipient}`);
  console.log(`  - recipient missing code/country: ${wrongFormatRecipientIncomplete}`);
  console.log(`  - renamable now:                  ${renamable}`);
  console.log("\nSamples:");
  for (const s of samples) console.log(`  ${s.sku.padEnd(28)} — ${s.reason}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
