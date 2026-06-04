import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [
    productsAll,
    productsActive,
    productsDeleted,
    ordersAll,
    ordersActive,
    ordersDeleted,
    orderItems,
    productTrackItems,
    statusHistory,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: { not: null } } }),
    prisma.order.count(),
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { deletedAt: { not: null } } }),
    prisma.orderItem.count(),
    prisma.productTrackItem.count(),
    prisma.orderStatusHistory.count(),
  ]);

  console.log("== Product (= Заказы) ==");
  console.log("  total:    ", productsAll);
  console.log("  active:   ", productsActive);
  console.log("  deleted:  ", productsDeleted);
  console.log("== Order (= Посылки) ==");
  console.log("  total:    ", ordersAll);
  console.log("  active:   ", ordersActive);
  console.log("  deleted:  ", ordersDeleted);
  console.log("== Связанные ==");
  console.log("  OrderItem:          ", orderItems);
  console.log("  ProductTrackItem:   ", productTrackItems);
  console.log("  OrderStatusHistory: ", statusHistory);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
