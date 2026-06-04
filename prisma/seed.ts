import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Customer, type OrderStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { slugify } from "../lib/utils";
import { parseOrderRoute } from "./order-route";

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
  saleDateRaw: string | null;
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

type ParsedName = {
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
};

type ParsedAddress = {
  country: string | null;
  city: string | null;
  postalCode: string | null;
  address: string | null;
};

type RecipientProfile = ParsedName &
  ParsedAddress & {
    clientCode: string | null;
    name: string;
    phone: string | null;
    informationDate: Date | null;
    informationDateText: string | null;
    sourceSheet: string;
    sourceRow: number;
  };

type OrderRouteParts = {
  routePrefix: string | null;
  routeNumber: string | null;
  routeCountry: string | null;
};

function compact(value: string | null | undefined): string | null {
  const clean = value?.replace(/\s+/g, " ").trim();
  const lower = clean?.toLowerCase();
  if (
    !clean ||
    lower === "x" ||
    lower === "#знач!" ||
    lower === "#value!" ||
    lower === "#ref!" ||
    lower === "#n/a"
  ) {
    return null;
  }
  return clean;
}

function routeParts(order: BookOrder): OrderRouteParts {
  const parsed = parseOrderRoute(order.orderNumber);

  return {
    routePrefix: parsed?.routePrefix ?? compact(order.routePrefix),
    routeNumber: parsed?.routeNumber ?? compact(order.routeNumber),
    routeCountry: parsed?.routeCountry ?? compact(order.routeCountry),
  };
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

const COUNTRY_CODE_LABELS: Record<string, string> = {
  AT: "Austria",
  AU: "Australia",
  BG: "Bulgaria",
  BL: "Belgium",
  BY: "Belarus",
  CA: "Canada",
  CAD: "Canada",
  CH: "Switzerland",
  CN: "China",
  CS: "Czechia",
  CY: "Cyprus",
  CZ: "Czechia",
  DE: "Germany",
  DK: "Denmark",
  ES: "Spain",
  FR: "France",
  GE: "Georgia",
  GR: "Greece",
  HU: "Hungary",
  ID: "Indonesia",
  IT: "Italy",
  JP: "Japan",
  KZ: "Kazakhstan",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  MC: "Monaco",
  MD: "Moldova",
  ME: "Montenegro",
  MN: "Mongolia",
  MT: "Malta",
  MX: "Mexico",
  NL: "Netherlands",
  NO: "Norway",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  RS: "Serbia",
  RU: "Russia",
  SA: "Saudi Arabia",
  SE: "Sweden",
  SG: "Singapore",
  SL: "Slovenia",
  SW: "Switzerland",
  TR: "Turkey",
  UA: "Ukraine",
  UAE: "United Arab Emirates",
  UK: "United Kingdom",
  US: "USA",
  UZ: "Uzbekistan",
};

const COUNTRY_ALIASES: Record<string, string> = {
  belarus: "Belarus",
  canada: "Canada",
  china: "China",
  cyprus: "Cyprus",
  deutschland: "Germany",
  espana: "Spain",
  españa: "Spain",
  france: "France",
  germany: "Germany",
  hungary: "Hungary",
  italia: "Italy",
  italy: "Italy",
  moldova: "Moldova",
  "o'zbekiston": "Uzbekistan",
  poland: "Poland",
  russia: "Russia",
  slovenia: "Slovenia",
  spain: "Spain",
  switzerland: "Switzerland",
  ukraine: "Ukraine",
  "united kingdom": "United Kingdom",
  "united states": "USA",
  usa: "USA",
  uzbekistan: "Uzbekistan",
  молдова: "Moldova",
  россия: "Russia",
  украина: "Ukraine",
  україна: "Ukraine",
  узбекистан: "Uzbekistan",
};

function splitRecipientName(value: string | null): ParsedName {
  const name = compact(value);
  if (!name) {
    return { lastName: null, firstName: null, middleName: null };
  }

  const clean = name
    .replace(/\b[A-Z]{1,3}\d{5,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 0) {
    return { lastName: null, firstName: null, middleName: null };
  }
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: null, middleName: null };
  }

  const hasCyrillic = /[А-Яа-яЁёІіЇїЄєҐґ]/.test(clean);
  if (hasCyrillic) {
    return {
      lastName: parts[0] ?? null,
      firstName: parts[1] ?? null,
      middleName: parts.slice(2).join(" ") || null,
    };
  }

  return {
    lastName: parts.at(-1) ?? null,
    firstName: parts[0] ?? null,
    middleName: parts.slice(1, -1).join(" ") || null,
  };
}

function countryFromCode(value: string | null): string | null {
  const code = compact(value)?.toUpperCase();
  return code ? COUNTRY_CODE_LABELS[code] ?? code : null;
}

function extractPostalCode(value: string): string | null {
  const patterns = [
    /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i,
    /\b[A-Z]{1,3}-\d{3,6}\b/i,
    /\b\d{2}-\d{3}\b/,
    /\b[A-Z]{2}\s+\d{4,6}\b/i,
    /\b\d{4,6}\b/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[0]) {
      const postalCode = match[0].replace(/\s+/g, " ").trim();
      return postalCode.match(/^[A-Z]{2}\s+\d{4,6}$/i)
        ? postalCode.replace(/^[A-Z]{2}\s+/i, "")
        : postalCode;
    }
  }

  return null;
}

function consumeCountry(part: string): { country: string | null; rest: string | null } {
  const normalized = part.trim().toLowerCase();
  const exact = COUNTRY_ALIASES[normalized];
  if (exact) {
    return { country: exact, rest: null };
  }

  for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
    if (normalized.startsWith(`${alias} `)) {
      return { country, rest: part.slice(alias.length).trim() || null };
    }
  }

  return { country: null, rest: part.trim() || null };
}

function cityFromAddressParts(parts: string[], postalCode: string | null): string | null {
  const streetSignals = /(str\.?|street|ул\.?|вул\.?|дом|apt|кв\.?|via|avenida|boulevard|проспект|пошта|почта|отделение|drevored|road|lane|drive|place|square|crown)/i;

  for (const part of parts) {
    const withoutPostal = postalCode ? part.replace(postalCode, " ") : part;
    const candidate = withoutPostal
      .replace(/\b[A-Z]{2}\b/g, " ")
      .replace(/\b\d{4,6}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!candidate || candidate.length < 2 || streetSignals.test(candidate)) {
      continue;
    }

    return candidate;
  }

  return null;
}

function parseRecipientAddress(address: string | null, countryCode: string | null): ParsedAddress {
  const cleanAddress = compact(address);
  if (!cleanAddress) {
    return {
      country: countryFromCode(countryCode),
      city: null,
      postalCode: null,
      address: null,
    };
  }

  const postalCode = extractPostalCode(cleanAddress);
  let country = countryFromCode(countryCode);
  const parts = cleanAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const addressParts: string[] = [];

  for (const part of parts) {
    const consumed = consumeCountry(part);
    country = consumed.country ?? country;
    if (consumed.rest) {
      addressParts.push(consumed.rest);
    }
  }

  const city = cityFromAddressParts(addressParts.length ? addressParts : parts, postalCode);

  return {
    country,
    city,
    postalCode,
    address: cleanAddress,
  };
}

function recipientProfile(order: BookOrder): RecipientProfile {
  const route = routeParts(order);
  const name = compact(order.recipientName) ?? route.routePrefix ?? "Получатель без имени";
  const address = compact(order.recipientAddress);
  const phone = compact(order.recipientPhone);
  const informationDate = toDate(order.saleDate);

  return {
    clientCode: route.routePrefix,
    name,
    ...splitRecipientName(name),
    ...parseRecipientAddress(address, route.routeCountry),
    phone: phone && phone !== address ? phone : null,
    informationDate,
    informationDateText: informationDate ? null : compact(order.saleDateRaw),
    sourceSheet: "ALL 6",
    sourceRow: order.sourceRow,
  };
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
  const subtotalCny = totalUsd * rate + (order.localDeliveryCny ?? 0);
  const discountPercent = order.discountCny ?? 0;
  return subtotalCny - subtotalCny * (discountPercent / 100);
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

function itemQuantity(order: BookOrder): number {
  return Math.max(1, order.packageCount ?? 1);
}

function itemLineTotalUsd(order: BookOrder, fallbackTotalUsd: number): number {
  return order.insuranceUsd ?? fallbackTotalUsd;
}

function itemUnitPriceUsd(order: BookOrder, fallbackTotalUsd: number): number {
  return itemLineTotalUsd(order, fallbackTotalUsd) / itemQuantity(order);
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
    const nameParts = splitRecipientName(name);

    const created = await prisma.customer.create({
      data: {
        code,
        name,
        ...nameParts,
        email,
        phone: compact(customer.phone),
        username: compact(customer.username),
        country: compact(customer.country),
        city: compact(customer.city),
        sourceSheet: "Клиенты",
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
  const route = routeParts(order);
  const name = compact(order.recipientName) ?? route.routePrefix ?? "Получатель без имени";
  const key = recipientKey(name, order.recipientPhone, order.recipientAddress);
  const existing = byIdentity.get(key);
  if (existing) {
    return existing;
  }

  const routeCustomer = route.routePrefix ? byCode.get(route.routePrefix) : undefined;
  if (routeCustomer && !compact(order.recipientName)) {
    return routeCustomer;
  }

  const created = await prisma.customer.create({
    data: {
      ...recipientProfile(order),
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
      price: itemUnitPriceUsd(order, orderTotalUsd(order)),
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
    const quantity = itemQuantity(row);
    const lineTotalUsd = itemLineTotalUsd(row, totalUsd);
    const unitPriceUsd = itemUnitPriceUsd(row, totalUsd);
    const rate = row.exchangeRateCnyPerUsd ?? DEFAULT_RATE;
    const totalCny = orderTotalCny(row, totalUsd);
    const createdAt = toDate(row.saleDate) ?? FALLBACK_ORDER_DATE;
    const status = mapStatus(row);
    const number = makeUnique(row.orderNumber, usedOrderNumbers, "order");
    const route = routeParts({ ...row, orderNumber: number });

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
        routePrefix: route.routePrefix,
        routeNumber: route.routeNumber,
        routeCountry: route.routeCountry,
        customerId: customer.id,
        createdAt,
        items: {
          create: {
            productId,
            quantity,
            price: unitPriceUsd,
            name: productName(row),
            sourceInfo: compact(row.sourceInfo),
            declaredValueUsd: row.totalUsd,
            weightKg: row.weightKg,
            lineTotalUsd,
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
