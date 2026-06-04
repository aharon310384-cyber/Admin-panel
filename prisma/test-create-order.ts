import { prisma } from "../lib/prisma";

async function nextRouteNumber(): Promise<number> {
  const rows = await prisma.order.findMany({
    where: { routeNumber: { not: null } },
    select: { routeNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = Number.parseInt(r.routeNumber ?? "", 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

function buildOrderNumber(clientCode: string, n: number, countryCode: string) {
  return `${clientCode}${n}${countryCode}`;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", deletedAt: null },
  });
  if (!admin) {
    console.error("Нет admin-пользователя. Прерывание.");
    process.exit(1);
  }

  const recipient = await prisma.customer.findFirst({
    where: {
      deletedAt: null,
      countryCode: { not: null },
      OR: [{ clientCode: { not: null } }, { code: { not: null } }],
    },
    select: {
      id: true,
      name: true,
      code: true,
      clientCode: true,
      country: true,
      countryCode: true,
    },
  });
  if (!recipient) {
    console.error("Нет получателей с заполненными clientCode и countryCode.");
    process.exit(1);
  }

  const product = await prisma.product.findFirst({
    where: { deletedAt: null, isActive: true },
    select: { id: true, name: true, sku: true, price: true },
  });
  if (!product) {
    console.error("Нет активных продуктов.");
    process.exit(1);
  }

  const clientCode = (recipient.clientCode ?? recipient.code ?? "")
    .trim()
    .toUpperCase();
  const countryCode = (recipient.countryCode ?? "").trim().toUpperCase();
  const routeNumber = await nextRouteNumber();
  const number = buildOrderNumber(clientCode, routeNumber, countryCode);

  console.log("\n=== Параметры тестового заказа ===");
  console.log(`  Получатель: ${recipient.name} (id=${recipient.id})`);
  console.log(
    `  clientCode=${clientCode}, countryCode=${countryCode}, страна="${recipient.country ?? "—"}"`
  );
  console.log(`  Продукт: ${product.name} (${product.sku})`);
  console.log(`  Цена: ${Number(product.price)} USD × 1`);
  console.log(`  Следующий routeNumber: ${routeNumber}`);
  console.log(`  Сгенерированный номер: \x1b[1m${number}\x1b[0m\n`);

  const exchangeRate = 7.1;
  const totalUsd = Number(product.price);
  const totalCny = totalUsd * exchangeRate;

  const order = await prisma.order.create({
    data: {
      number,
      customerId: recipient.id,
      status: "NEW",
      notes: "Тестовый заказ (создан скриптом prisma/test-create-order.ts)",
      total: totalUsd,
      totalUsd,
      exchangeRateCnyPerUsd: exchangeRate,
      totalCny,
      routePrefix: clientCode,
      routeNumber: String(routeNumber),
      routeCountry: countryCode,
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          price: totalUsd,
        },
      },
      statusHistory: {
        create: { status: "NEW", changedBy: admin.id, note: "Создан тестовый заказ" },
      },
    },
    include: {
      items: true,
      statusHistory: true,
      customer: { select: { name: true, clientCode: true, countryCode: true } },
    },
  });

  console.log("=== Заказ создан ===");
  console.log(`  id: ${order.id}`);
  console.log(`  number: ${order.number}`);
  console.log(`  status: ${order.status}`);
  console.log(`  routePrefix/Number/Country: ${order.routePrefix} / ${order.routeNumber} / ${order.routeCountry}`);
  console.log(`  totalUsd: ${order.totalUsd}, totalCny: ${order.totalCny}`);
  console.log(`  items: ${order.items.length}, statusHistory: ${order.statusHistory.length}`);

  // Перепроверка через выборку из БД
  const fetched = await prisma.order.findUnique({
    where: { number },
    select: { id: true, number: true, deletedAt: true },
  });
  console.log(`\n=== Перепроверка по номеру ${number} ===`);
  console.log(`  Найден: ${fetched ? "да" : "нет"} (id=${fetched?.id ?? "—"})`);

  // Soft-delete, чтобы заказ не висел в списках
  await prisma.order.update({
    where: { id: order.id },
    data: { deletedAt: new Date() },
  });
  console.log("\n  Помечен как удалённый (deletedAt). В UI не появится, но запись осталась в БД.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
