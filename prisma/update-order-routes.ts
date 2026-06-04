import { PrismaClient, type Prisma } from "@prisma/client";
import { parseOrderRoute } from "./order-route";

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

type OrderWithRoute = {
  id: string;
  number: string;
  routePrefix: string | null;
  routeNumber: string | null;
  routeCountry: string | null;
};

function orderRouteUpdate(
  order: OrderWithRoute
): Pick<OrderWithRoute, "routePrefix" | "routeNumber" | "routeCountry"> | null {
  const parsed = parseOrderRoute(order.number);
  if (!parsed) {
    return null;
  }

  if (
    order.routePrefix === parsed.routePrefix &&
    order.routeNumber === parsed.routeNumber &&
    order.routeCountry === parsed.routeCountry
  ) {
    return null;
  }

  return parsed;
}

async function main() {
  const orders = await prisma.order.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      number: true,
      routePrefix: true,
      routeNumber: true,
      routeCountry: true,
    },
  });

  let pending: Prisma.PrismaPromise<unknown>[] = [];
  let updated = 0;
  let skipped = 0;

  async function flushPending() {
    if (pending.length === 0) {
      return;
    }

    await prisma.$transaction(pending);
    updated += pending.length;
    pending = [];
  }

  for (const order of orders) {
    const data = orderRouteUpdate(order);
    if (!data) {
      skipped += 1;
      continue;
    }

    pending.push(prisma.order.update({ where: { id: order.id }, data }));
    if (pending.length >= BATCH_SIZE) {
      await flushPending();
    }
  }

  await flushPending();
  console.log(`Updated ${updated} order routes from order numbers. Skipped ${skipped} orders.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
