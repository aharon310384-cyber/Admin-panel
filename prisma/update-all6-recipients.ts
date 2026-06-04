import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseOrderRoute } from "./order-route";

const prisma = new PrismaClient();

type BookOrder = {
  sourceRow: number;
  orderNumber: string;
  saleDate: string | null;
  saleDateRaw: string | null;
  recipientName: string | null;
  recipientAddress: string | null;
  recipientPhone: string | null;
  routePrefix: string | null;
  routeCountry: string | null;
};

type BookImport = {
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
  routeCountry: string | null;
};

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
    routeCountry: parsed?.routeCountry ?? compact(order.routeCountry),
  };
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

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

async function loadImport(): Promise<BookImport> {
  const importPath = path.join(process.cwd(), "Downloads", "book-2-import.json");
  const raw = await readFile(importPath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, "")) as BookImport;
}

async function main() {
  const data = await loadImport();
  const seenCustomerIds = new Set<string>();
  let updated = 0;
  let skipped = 0;

  for (const row of data.orders) {
    if (!compact(row.recipientName) || !compact(row.recipientAddress)) {
      skipped += 1;
      continue;
    }

    const order = await prisma.order.findFirst({
      where: { sourceSheet: "ALL 6", sourceRow: row.sourceRow, deletedAt: null },
      select: { customerId: true },
    });

    if (!order || seenCustomerIds.has(order.customerId)) {
      skipped += 1;
      continue;
    }

    await prisma.customer.update({
      where: { id: order.customerId },
      data: recipientProfile(row),
    });
    seenCustomerIds.add(order.customerId);
    updated += 1;
  }

  console.log(`Updated ${updated} recipients from ALL 6. Skipped ${skipped} rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
