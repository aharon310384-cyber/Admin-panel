import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORDER_ROUTE_PATTERN = /^([A-Z]{1,6}?)(\d+)([A-Z]{2,4})(?=$|[^A-Z0-9])/i;

function parseRoute(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  const match = normalized.match(ORDER_ROUTE_PATTERN);
  return match ? { prefix: match[1], number: match[2], country: match[3] } : null;
}

async function main() {
  const orders = await prisma.order.findMany({
    where: { deletedAt: null, customerId: null },
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      comments: true,
      trackItems: {
        select: { trackNumber: true, name: true, productUrl: true },
      },
    },
  });

  const remaining = orders.filter((o) => !parseRoute(o.sku));
  console.log(`Orphan orders without customer: ${remaining.length}\n`);

  for (const o of remaining) {
    console.log("=".repeat(80));
    console.log(`SKU:         ${o.sku}`);
    console.log(`name:        ${(o.name ?? "").slice(0, 200)}`);
    if (o.description?.trim()) console.log(`description: ${o.description.slice(0, 400)}`);
    if (o.comments?.trim()) console.log(`comments:    ${o.comments.slice(0, 400)}`);
    if (o.trackItems.length > 0) {
      console.log("trackItems:");
      for (const t of o.trackItems) {
        console.log(`  trackNumber="${t.trackNumber}" name="${(t.name ?? "").slice(0, 80)}" url="${(t.productUrl ?? "").slice(0, 80)}"`);
      }
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("ERROR:", e);
    prisma.$disconnect();
    process.exit(1);
  });
