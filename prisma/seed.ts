import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Customer, type OrderStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { slugify } from "../lib/utils";

const prisma = new PrismaClient();
const DEFAULT_RATE = 7.1;
const FALLBACK_ORDER_DATE = new Date("2022-01-01T00:00:00.000Z");

type BookCustomer = {
  sourceRow: number;
  code: string | null;
  name: string | null;
  phone: string | null;
  username: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
};

type BookOrder = {
  sourceRow: number;
  orderNumber: string;
  lr: string | null;
  sourceInfo: string | null;
  itemName: string | null;
  packageCount: number | null;
  insuranceUsd: number | null;
  weightKg: number | null;
  consolidationUsd: number | null;
  packagingUsd: number | null;
  totalUsd: number | null;
  calculationUsd: number | null;
  exchangeRateCnyPerUsd: number | null;
  localDeliveryCny: number | null;
  discountCny: number | null;
  totalCny: number | null;
  paymentMark: string | null;
  paymentFill: string | null;
  isPaid: boolean;
  parcelNumber: string | null;
  parcelRaw: string | null;
  parcelNumberLooksValid: boolean;
  supplierCostCny: number | null;
  profitCny: number | null;
  saleDate: string | null;
  recipientName: string | null;
  recipientAddress: string | null;
  recipientPhone: string | null;
  site: string | null;
  routePrefix: string | null;
  routeNumber: string | null;
  routeCountry: string | null;
  orangePair: boolean;
  orangeYellowPair: boolean;
};

type BookImport = {
  customers: BookCustomer[];
  orders: BookOrder[];
};

function compact(value: string | null | undefined): string | null {
  const clean = value?.replace(/\s+/g, " ").trim();
  if (!clean || clean.toLowerCase() === "x") {
    return null;
  }
  return clean;
}

function hash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function normalizeEmail(value: string | null, usedEmails: Set<string>): string | null {
  const email = compact(value)?.toLowerCase() ?? null;
  if (!email || !email.includes("@") || usedEmails.has(email)) {
    return null;
  }
  usedEmails.add(email);
  return email;
}

function makeUnique(value: string, used: Set<string>, fallbackPrefix: string): string {
  const base = compact(value) ?? `${fallbackPrefix}-${used.size + 1}`;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }
  const unique = `${base}-${index}`;
  used.add(unique);
  return unique;
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function orderTotalUsd(order: BookOrder): number {
  if (order.calculationUsd !== null) {
    return order.calculationUsd;
  }
  if (order.totalUsd !== null) {
    return order.totalUsd;
  }
  if (order.totalCny !== null && order.exchangeRateCnyPerUsd) {
    return order.totalCny / order.exchangeRateCnyPerUsd;
  }
  return 0;
}

function orderTotalCny(order: BookOrder, totalUsd: number): number {
  if (order.totalCny !== null) {
    return order.totalCny;
  }
  const rate = order.exchangeRateCnyPerUsd ?? DEFAULT_RATE;
  return totalUsd * rate + (order.localDeliveryCny ?? 0) - (order.discountCny ?? 0);
}

function containsCancelSignal(value: string | null): boolean {
  const text = compact(value)?.toLowerCase() ?? "";
  return (
    text.includes("отмен") ||
    text.includes("утилиз") ||
    text.includes("нету") ||
    text.includes("нет этих")
  );
}

function mapStatus(order: BookOrder): OrderStatus {
  if (order.orangeYellowPair) {
    return "RETURNED_UNPAID";
  }
  if (order.orangePair) {
    return order.isPaid ? "RETURNED_PAID" : "RETURNED_UNPAID";
  }
  if (containsCancelSignal(order.parcelRaw) || containsCancelSignal(order.parcelNumber)) {
    return "CANCELED";
  }
  if (!order.isPaid) {
    return "NEW";
  }
  if (!order.parcelNumberLooksValid) {
    return "PAID";
  }
  return "SHIPPED";
}

function productName(order: BookOrder): string {
  return compact(order.itemName) ?? compact(order.lr) ?? "Позиция из book-2";
}

function productSlug(name: string): string {
  const slug = slugify(name).slice(0, 60);
  return slug ? `${slug}-${hash(name)}` : `book2-${hash(name)}`;
}

async function loadImport(): Promise<BookImport> {
  const importPath = path.join(process.cwd(), "Downloads", "book-2-import.json");
  const raw = await readFile(importPath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, "")) as BookImport;
}

async function upsertUsers() {
  const adminPassword = await bcrypt.hash(process.env.DEMO_ADMIN_PASSWORD ?? "admin123", 12);
  const managerPassword = await bcrypt.hash(process.env.DEMO_MANAGER_PASSWORD ?? "manager123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@postmanfox.local" },
    update: { name: "Администратор", role: "ADMIN", deletedAt: null },
    create: {
      email: "admin@postmanfox.local",
      password: adminPassword,
      name: "Администратор",
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "manager@postmanfox.local" },
    update: { name: "Менеджер", role: "MANAGER", deletedAt: null },
    create: {
      email: "manager@postmanfox.local",
      password: managerPassword,
      name: "Менеджер",
      role: "MANAGER",
    },
  });

  return admin;
}

async function clearImportedData() {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
}

async function importSheetCustomers(
  customers: BookCustomer[],
  usedEmails: Set<string>,
  usedCodes: Set<string>
) {
  const byCode = new Map<string, Customer>();
  const byIdentity = new Map<string, Customer>();

  for (const customer of customers) {
    const name = compact(customer.name) ?? compact(customer.code) ?? `Получатель ${customer.sourceRow}`;
    const originalCode = compact(customer.code);
    const code = originalCode ? makeUnique(originalCode, usedCodes, "client") : null;
    const email = normalizeEmail(customer.email, usedEmails);

    const created = await prisma.customer.create({
      data: {
        code,
        name,
        email,
        phone: compact(customer.phone),
        username: compact(customer.username),
        country: compact(customer.country),
        city: compact(customer.city),
        sourceRow: customer.sourceRow,
      },
    });

    if (originalCode) {
      byCode.set(originalCode, created);
    }
    byIdentity.set(recipientKey(name, customer.phone, null), created);
  }

  return { byCode, byIdentity };
}

function recipientKey(
  name: string | null | undefined,
  phone: string | null | undefined,
  address: string | null | undefined
): string {
  return [compact(name), compact(phone), compact(address)]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

async function findOrCreateRecipient(
  order: BookOrder,
  byCode: Map<string, Customer>,
  byIdentity: Map<string, Customer>
) {
  const name = compact(order.recipientName) ?? compact(order.routePrefix) ?? "Получатель без имени";
  const key = recipientKey(name, order.recipientPhone, order.recipientAddress);
  const existing = byIdentity.get(key);
  if (existing) {
    return existing;
  }

  const routeCustomer = order.routePrefix ? byCode.get(order.routePrefix) : undefined;
  if (routeCustomer && !compact(order.recipientName)) {
    return routeCustomer;
  }

  const created = await prisma.customer.create({
    data: {
      name,
      phone: compact(order.recipientPhone),
      country: compact(order.routeCountry),
      address: compact(order.recipientAddress),
      sourceRow: order.sourceRow,
    },
  });
  byIdentity.set(key, created);
  return created;
}

async function findOrCreateProduct(
  order: BookOrder,
  productIdsByName: Map<string, string>
) {
  const name = productName(order).slice(0, 180);
  const key = name.toLowerCase();
  const existing = productIdsByName.get(key);
  if (existing) {
    return existing;
  }

  const sku = `BOOK2-${hash(key).toUpperCase()}`;
  const created = await prisma.product.create({
    data: {
      name,
      slug: productSlug(name),
      sku,
      description: compact(order.sourceInfo),
      price: orderTotalUsd(order),
      stock: 999,
      isActive: true,
    },
  });

  productIdsByName.set(key, created.id);
  return created.id;
}

async function importOrders(
  orders: BookOrder[],
  adminId: string,
  byCode: Map<string, Customer>,
  byIdentity: Map<string, Customer>
) {
  const usedOrderNumbers = new Set<string>();
  const productIdsByName = new Map<string, string>();

  for (const row of orders) {
    const customer = await findOrCreateRecipient(row, byCode, byIdentity);
    const productId = await findOrCreateProduct(row, productIdsByName);
    const totalUsd = orderTotalUsd(row);
    const rate = row.exchangeRateCnyPerUsd ?? DEFAULT_RATE;
    const totalCny = orderTotalCny(row, totalUsd);
    const createdAt = toDate(row.saleDate) ?? FALLBACK_ORDER_DATE;
    const status = mapStatus(row);
    const number = makeUnique(row.orderNumber, usedOrderNumbers, "order");

    const order = await prisma.order.create({
      data: {
        number,
        status,
        total: totalUsd,
        totalUsd,
        exchangeRateCnyPerUsd: rate,
        totalCny,
        localDeliveryCny: row.localDeliveryCny,
        discountCny: row.discountCny,
        supplierCostCny: row.supplierCostCny,
        profitCny: row.profitCny,
        isPaid: row.isPaid,
        paymentMark: row.paymentMark,
        parcelNumber: compact(row.parcelNumber),
        parcelNumberLooksValid: row.parcelNumberLooksValid,
        sourceSheet: "ALL 6",
        sourceRow: row.sourceRow,
        lr: compact(row.lr),
        sourceInfo: compact(row.sourceInfo),
        packageCount: row.packageCount,
        insuranceUsd: row.insuranceUsd,
        weightKg: row.weightKg,
        consolidationUsd: row.consolidationUsd,
        packagingUsd: row.packagingUsd,
        calculationUsd: row.calculationUsd,
        saleDate: toDate(row.saleDate),
        recipientName: compact(row.recipientName),
        recipientAddress: compact(row.recipientAddress),
        recipientPhone: compact(row.recipientPhone),
        routePrefix: compact(row.routePrefix),
        routeNumber: compact(row.routeNumber),
        routeCountry: compact(row.routeCountry),
        customerId: customer.id,
        createdAt,
        items: {
          create: {
            productId,
            quantity: 1,
            price: totalUsd,
            name: compact(row.itemName),
            sourceInfo: compact(row.sourceInfo),
            declaredValueUsd: row.totalUsd,
            weightKg: row.weightKg,
            lineTotalUsd: totalUsd,
          },
        },
      },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status,
        changedBy: adminId,
        note: `Импортировано из ALL 6, строка ${row.sourceRow}`,
        createdAt,
      },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Import seed is disabled in production.");
  }

  const data = await loadImport();
  const admin = await upsertUsers();
  const usedEmails = new Set<string>();
  const usedCodes = new Set<string>();

  console.log("Clearing local demo orders, recipients and services...");
  await clearImportedData();

  console.log("Importing recipients from book-2...");
  const { byCode, byIdentity } = await importSheetCustomers(
    data.customers,
    usedEmails,
    usedCodes
  );

  console.log("Importing orders from book-2...");
  await importOrders(data.orders, admin.id, byCode, byIdentity);

  console.log(`Imported ${data.customers.length} sheet recipients and ${data.orders.length} orders.`);
  console.log("Dev users:");
  console.log("  admin@postmanfox.local / admin123");
  console.log("  manager@postmanfox.local / manager123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
