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
    where: { deletedAt: null },
    select: {
      id: true,
      sku: true,
      name: true,
      customerId: true,
      customer: {
        select: {
          id: true,
          name: true,
          code: true,
          clientCode: true,
          countryCode: true,
          country: true,
        },
      },
      parcelItems: {
        select: {
          parcel: {
            select: {
              number: true,
              routePrefix: true,
              routeCountry: true,
              customer: { select: { id: true, name: true, clientCode: true, code: true, countryCode: true, country: true } },
            },
          },
        },
      },
    },
  });

  const remaining = orders.filter((o) => !parseRoute(o.sku));
  console.log(`Remaining (not renumbered): ${remaining.length}\n`);

  const groups = {
    noCustomerNoParcel: [] as typeof remaining,
    noCustomerHasParcel: [] as typeof remaining,
    hasCustomerMissingClientCode: [] as typeof remaining,
    hasCustomerMissingCountryCode: [] as typeof remaining,
    hasCustomerMissingBoth: [] as typeof remaining,
  };

  for (const o of remaining) {
    if (!o.customer) {
      if (o.parcelItems.length > 0) groups.noCustomerHasParcel.push(o);
      else groups.noCustomerNoParcel.push(o);
      continue;
    }
    const cc = (o.customer.clientCode ?? o.customer.code ?? "").trim();
    const country = (o.customer.countryCode ?? "").trim();
    if (!cc && !country) groups.hasCustomerMissingBoth.push(o);
    else if (!cc) groups.hasCustomerMissingClientCode.push(o);
    else if (!country) groups.hasCustomerMissingCountryCode.push(o);
  }

  console.log("Group A: no customer & no parcel link (orphans):", groups.noCustomerNoParcel.length);
  for (const o of groups.noCustomerNoParcel.slice(0, 6)) {
    console.log(`  ${o.sku.padEnd(28)} name="${(o.name ?? "").slice(0, 60)}"`);
  }

  console.log("\nGroup B: no customer but has parcel link:", groups.noCustomerHasParcel.length);
  for (const o of groups.noCustomerHasParcel.slice(0, 6)) {
    const pInfo = o.parcelItems
      .map((pi) => {
        const c = pi.parcel.customer;
        return `parcel=${pi.parcel.number} cust=${c.name} clientCode="${c.clientCode ?? c.code ?? ""}" country="${c.countryCode ?? ""}"`;
      })
      .join(" | ");
    console.log(`  ${o.sku.padEnd(28)} ${pInfo}`);
  }

  console.log("\nGroup C: customer missing clientCode only:", groups.hasCustomerMissingClientCode.length);
  for (const o of groups.hasCustomerMissingClientCode.slice(0, 6)) {
    console.log(
      `  ${o.sku.padEnd(28)} customer="${o.customer!.name}" countryCode="${o.customer!.countryCode}" country="${o.customer!.country ?? ""}"`
    );
  }

  console.log("\nGroup D: customer missing countryCode only:", groups.hasCustomerMissingCountryCode.length);
  for (const o of groups.hasCustomerMissingCountryCode.slice(0, 6)) {
    console.log(
      `  ${o.sku.padEnd(28)} customer="${o.customer!.name}" clientCode="${o.customer!.clientCode ?? o.customer!.code}" country="${o.customer!.country ?? ""}"`
    );
  }

  console.log("\nGroup E: customer missing both:", groups.hasCustomerMissingBoth.length);
  for (const o of groups.hasCustomerMissingBoth.slice(0, 6)) {
    console.log(
      `  ${o.sku.padEnd(28)} customer="${o.customer!.name}" country="${o.customer!.country ?? ""}"`
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("ERROR:", e);
    prisma.$disconnect();
    process.exit(1);
  });
