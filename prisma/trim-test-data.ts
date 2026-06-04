import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CHUNK = 500;

function chunk<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log("== Подсчёт ДО ==");
  const before = {
    products: await prisma.product.count(),
    productsActive: await prisma.product.count({ where: { deletedAt: null } }),
    orders: await prisma.order.count(),
    ordersActive: await prisma.order.count({ where: { deletedAt: null } }),
    orderItems: await prisma.orderItem.count(),
    statusHistory: await prisma.orderStatusHistory.count(),
    trackItems: await prisma.productTrackItem.count(),
  };
  console.log(before);

  // === 1. Order: оставить top 1/3 по createdAt DESC ===
  const keepOrdersCount = Math.ceil(before.ordersActive / 3);
  const ordersToKeep = await prisma.order.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: keepOrdersCount,
    select: { id: true },
  });
  const keepOrderIds = new Set(ordersToKeep.map((o) => o.id));
  console.log(`Order: оставляем ${keepOrderIds.size} из ${before.ordersActive} (cutoff по createdAt DESC)`);

  const ordersToDelete = await prisma.order.findMany({
    where: { id: { notIn: ordersToKeep.map((o) => o.id) } },
    select: { id: true },
  });
  const deleteOrderIds = ordersToDelete.map((o) => o.id);
  console.log(`Order: к удалению ${deleteOrderIds.length}`);

  // === 2. Удалить OrderStatusHistory для удаляемых Order ===
  let deletedHistory = 0;
  for (const c of chunk(deleteOrderIds)) {
    const r = await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: c } },
    });
    deletedHistory += r.count;
  }
  console.log(`OrderStatusHistory удалено: ${deletedHistory}`);

  // === 3. Удалить OrderItem для удаляемых Order ===
  let deletedOrderItems = 0;
  for (const c of chunk(deleteOrderIds)) {
    const r = await prisma.orderItem.deleteMany({
      where: { orderId: { in: c } },
    });
    deletedOrderItems += r.count;
  }
  console.log(`OrderItem удалено: ${deletedOrderItems}`);

  // === 4. Удалить сами Order ===
  let deletedOrders = 0;
  for (const c of chunk(deleteOrderIds)) {
    const r = await prisma.order.deleteMany({
      where: { id: { in: c } },
    });
    deletedOrders += r.count;
  }
  console.log(`Order удалено: ${deletedOrders}`);

  // === 5. Product: оставить top 1/3 активных + те, что ссылаются из оставшихся OrderItem ===
  const productsActiveAfter = before.productsActive;
  const keepProductsCount = Math.ceil(productsActiveAfter / 3);
  const productsToKeep = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: keepProductsCount,
    select: { id: true },
  });
  const keepProductIds = new Set(productsToKeep.map((p) => p.id));

  const referencedFromRemaining = await prisma.orderItem.findMany({
    distinct: ["productId"],
    select: { productId: true },
  });
  let addedFromReferences = 0;
  for (const r of referencedFromRemaining) {
    if (!keepProductIds.has(r.productId)) {
      keepProductIds.add(r.productId);
      addedFromReferences++;
    }
  }
  console.log(
    `Product: оставляем ${keepProductIds.size} (top ${keepProductsCount} активных + ${addedFromReferences} из ссылок OrderItem)`
  );

  // === 6. Удалить ProductTrackItem для удаляемых Product (cascade тоже сработает, делаем явно) ===
  const allProductIds = (await prisma.product.findMany({ select: { id: true } })).map((p) => p.id);
  const deleteProductIds = allProductIds.filter((id) => !keepProductIds.has(id));
  console.log(`Product: к удалению ${deleteProductIds.length}`);

  let deletedTrack = 0;
  for (const c of chunk(deleteProductIds)) {
    const r = await prisma.productTrackItem.deleteMany({
      where: { productId: { in: c } },
    });
    deletedTrack += r.count;
  }
  console.log(`ProductTrackItem удалено: ${deletedTrack}`);

  // === 7. Удалить сами Product ===
  let deletedProducts = 0;
  for (const c of chunk(deleteProductIds)) {
    const r = await prisma.product.deleteMany({
      where: { id: { in: c } },
    });
    deletedProducts += r.count;
  }
  console.log(`Product удалено: ${deletedProducts}`);

  console.log("== Подсчёт ПОСЛЕ ==");
  const after = {
    products: await prisma.product.count(),
    productsActive: await prisma.product.count({ where: { deletedAt: null } }),
    orders: await prisma.order.count(),
    ordersActive: await prisma.order.count({ where: { deletedAt: null } }),
    orderItems: await prisma.orderItem.count(),
    statusHistory: await prisma.orderStatusHistory.count(),
    trackItems: await prisma.productTrackItem.count(),
  };
  console.log(after);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
