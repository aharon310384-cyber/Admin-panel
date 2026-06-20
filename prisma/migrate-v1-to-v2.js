// Миграция данных v1 (admin-panel.db) → v2 (postmanfox.db).
// Запуск: DATABASE_URL="file:../data/postmanfox.db" node --experimental-sqlite prisma/migrate-v1-to-v2.js
// Источник НЕ изменяется (readOnly). Справочники тарифов/услуг берём из dev.db (их не было в v1).
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const src = new DatabaseSync("data/admin-panel.db", { readOnly: true });
const dev = new DatabaseSync("data/dev.db", { readOnly: true });
const prisma = new PrismaClient();

const all = (db, s) => db.prepare(s).all();
const D = (v) => (v == null ? null : Number(v)); // Decimal → number
const B = (v) => v === 1 || v === true || v === "1"; // sqlite int → boolean
const dt = (v) => (v == null ? undefined : new Date(v)); // DateTime (ms или ISO)
const id = () => randomUUID();

const PARCEL_STATUS = {
  NEW: "FORMED",
  PROCESSING: "ASSEMBLED",
  SHIPPED: "SHIPPED",
  COMPLETED: "DELIVERED",
  CANCELED: "UTILIZED",
  PAID: "READY_TO_SHIP",
  RETURNED_PAID: "RETURNED",
  RETURNED_UNPAID: "RETURNED",
};

function mapDelivery(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s.includes("ems")) return "EMS";
  if (s.includes("авиа") || s.includes("air")) return "AIR";
  if (s.includes("авто") || s.includes("auto") || s.includes("груз")) return "AUTO";
  if (s.includes("море") || s.includes("sea")) return "SEA";
  return null;
}

async function main() {
  const log = (...a) => console.log(...a);

  // ───────── 1. СПРАВОЧНИКИ ─────────
  const users = all(src, "SELECT * FROM User");
  await prisma.user.createMany({
    data: users.map((u) => ({
      id: u.id, email: u.email, password: u.password, name: u.name,
      role: u.role || "MANAGER", createdAt: dt(u.createdAt), updatedAt: dt(u.updatedAt), deletedAt: dt(u.deletedAt),
    })),
  });
  log("User:", users.length);

  const countries = all(src, "SELECT * FROM Country");
  await prisma.country.createMany({
    data: countries.map((c) => ({
      code: c.code, nameRu: c.nameRu, nameEn: c.nameEn,
      postalCodeRegex: c.postalCodeRegex, postalCodeExample: c.postalCodeExample,
      createdAt: dt(c.createdAt), updatedAt: dt(c.updatedAt),
    })),
  });
  log("Country:", countries.length);

  const fin = all(src, "SELECT * FROM FinanceSettings");
  for (const f of fin) {
    await prisma.financeSettings.create({
      data: { id: f.id, exchangeRateCnyPerUsd: D(f.exchangeRateCnyPerUsd) ?? 7.1, updatedAt: dt(f.updatedAt), updatedBy: f.updatedBy },
    });
  }
  log("FinanceSettings:", fin.length);

  const pnames = all(src, "SELECT * FROM ProductName");
  await prisma.productName.createMany({
    data: pnames.map((p) => ({
      id: p.id, code: p.code, nameRu: p.nameRu, nameEn: p.nameEn, nameCn: p.nameCn,
      createdAt: dt(p.createdAt), updatedAt: dt(p.updatedAt), deletedAt: dt(p.deletedAt),
    })),
  });
  log("ProductName:", pnames.length);

  // Тарифы/услуги — из dev.db (в v1 их не было)
  const shipping = all(dev, "SELECT * FROM ShippingTariff");
  await prisma.shippingTariff.createMany({
    data: shipping.map((t) => ({
      id: t.id, direction: t.direction, deliveryType: t.deliveryType,
      pricePerKgUsd: D(t.pricePerKgUsd), handlingFeeUsd: D(t.handlingFeeUsd),
      minDays: t.minDays, maxDays: t.maxDays, paymentTiming: t.paymentTiming || "BEFORE",
      volumetricDivisor: t.volumetricDivisor, minWeightKg: D(t.minWeightKg),
      active: B(t.active), createdAt: dt(t.createdAt), updatedAt: dt(t.updatedAt),
    })),
  });
  const services = all(dev, "SELECT * FROM ServiceTariff");
  await prisma.serviceTariff.createMany({
    data: services.map((s) => ({
      code: s.code, name: s.name, pricingType: s.pricingType, value: D(s.value),
      percentMin: D(s.percentMin), percentMax: D(s.percentMax),
      selectableByClient: B(s.selectableByClient), active: B(s.active), sortOrder: s.sortOrder ?? 0,
    })),
  });
  log("ShippingTariff:", shipping.length, "ServiceTariff:", services.length);

  // ───────── 2. КЛИЕНТЫ ─────────
  const allCust = all(src, "SELECT * FROM Customer WHERE deletedAt IS NULL");
  const custById = new Map(allCust.map((c) => [c.id, c]));
  const clients = allCust.filter((c) => c.code != null);
  const recipientsRows = allCust.filter((c) => c.code == null);

  // спец-клиенты для висячих/orphan clientCode
  const UNKNOWN_ID = "client_unknown";
  const orphanCodes = [...new Set(recipientsRows.map((r) => r.clientCode).filter(Boolean))]
    .filter((code) => !clients.some((c) => c.code === code));

  const usedEmail = new Set();
  const usedTg = new Set();
  function clientData(c) {
    let email = c.email || null;
    if (email && usedEmail.has(email.toLowerCase())) email = null;
    if (email) usedEmail.add(email.toLowerCase());
    let tg = c.telegramUserId || null;
    if (tg && usedTg.has(tg)) tg = null;
    if (tg) usedTg.add(tg);
    return {
      id: c.id, code: c.code, clientCode: c.clientCode, name: c.name,
      lastName: c.lastName, firstName: c.firstName, middleName: c.middleName,
      email, phone: c.phone, country: c.country, city: c.city, address: c.address,
      telegramUserId: tg, telegramChatId: c.telegramChatId, telegramUsername: c.telegramUsername,
      telegramLinkedAt: dt(c.telegramLinkedAt), passwordHash: c.passwordHash,
      createdAt: dt(c.createdAt), updatedAt: dt(c.updatedAt),
    };
  }
  await prisma.customer.createMany({ data: clients.map(clientData) });
  // orphan clientCodes → создаём клиента code=clientCode
  await prisma.customer.createMany({
    data: orphanCodes.map((code) => ({ id: "client_" + code, code, clientCode: code, name: code })),
  });
  // UNKNOWN для висячих получателей (clientCode пустой)
  await prisma.customer.create({ data: { id: UNKNOWN_ID, code: "__UNKNOWN__", name: "Неизвестный клиент" } });

  const clientIdByCode = new Map();
  for (const c of clients) clientIdByCode.set(c.code, c.id);
  for (const code of orphanCodes) clientIdByCode.set(code, "client_" + code);
  log("Customer (клиенты):", clients.length, "+ orphan:", orphanCodes.length, "+ UNKNOWN");

  // ───────── 3. ПОЛУЧАТЕЛИ ─────────
  const countrySet = new Set(countries.map((c) => c.code));
  function recipientCustomerId(row) {
    if (row.clientCode && clientIdByCode.has(row.clientCode)) return clientIdByCode.get(row.clientCode);
    return UNKNOWN_ID;
  }
  await prisma.recipient.createMany({
    data: recipientsRows.map((r) => ({
      id: r.id, customerId: recipientCustomerId(r), name: r.name || "Без имени",
      phone: r.phone,
      countryCode: r.countryCode && countrySet.has(r.countryCode) ? r.countryCode : null,
      country: r.country, city: r.city,
      address: r.address, postalCode: r.postalCode,
      createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
    })),
  });
  log("Recipient:", recipientsRows.length);

  // resolveOwner: для посылок/товаров (custId v1 указывает на строку-получателя или клиента)
  function resolveOwner(custId) {
    const row = custById.get(custId);
    if (!row) return { customerId: UNKNOWN_ID, recipientId: null };
    if (row.code) return { customerId: row.id, recipientId: null }; // это клиент
    const clientId = (row.clientCode && clientIdByCode.get(row.clientCode)) || UNKNOWN_ID;
    return { customerId: clientId, recipientId: row.id }; // строка-получатель
  }

  // ───────── 4. ПОСЫЛКИ ─────────
  const parcelsV1 = all(src, 'SELECT * FROM "Order"'); // в v1 таблица Order = посылка
  const usedNum = new Set();
  const parcelOwner = new Map(); // parcelId → {customerId, recipientId, deliveryType?, createdAt}
  const parcelData = parcelsV1.map((p) => {
    const owner = resolveOwner(p.customerId);
    let number = p.number;
    while (usedNum.has(number)) number = number + "_2";
    usedNum.add(number);
    parcelOwner.set(p.id, { ...owner, createdAt: dt(p.createdAt) });
    return {
      id: p.id, number, customerId: owner.customerId, recipientId: owner.recipientId,
      deliveryType: null,
      status: PARCEL_STATUS[p.status] || "FORMED",
      actualWeightKg: D(p.actualWeightKg) ?? D(p.weightKg),
      volumetricWeightKg: D(p.volumetricWeightKg),
      billableWeightKg: D(p.weightKg) ?? D(p.actualWeightKg),
      exchangeRateCnyPerUsd: D(p.exchangeRateCnyPerUsd) ?? 7.1,
      shippingCostUsd: D(p.calculationUsd),
      totalUsd: D(p.totalUsd) ?? D(p.total) ?? 0,
      totalCny: D(p.totalCny) ?? 0,
      isPaid: B(p.isPaid),
      trackingNumber: p.parcelNumber,
      notes: p.notes,
      createdAt: dt(p.createdAt), updatedAt: dt(p.updatedAt), deletedAt: dt(p.deletedAt),
    };
  });
  await prisma.parcel.createMany({ data: parcelData });
  log("Parcel:", parcelData.length);

  // ───────── 5. ЗАКАЗЫ-СТРОКИ ─────────
  const products = all(src, "SELECT * FROM Product");
  const productById = new Map(products.map((p) => [p.id, p]));
  const tracks = all(src, "SELECT * FROM ProductTrackItem ORDER BY createdAt ASC");
  const firstTrackByProduct = new Map();
  for (const t of tracks) if (!firstTrackByProduct.has(t.productId)) firstTrackByProduct.set(t.productId, t.trackNumber);

  const items = all(src, "SELECT * FROM OrderItem"); // позиции посылок
  const productsInParcel = new Set(items.map((i) => i.productId));

  const orderData = [];
  // 5a. строки из позиций посылок
  for (const it of items) {
    const parcel = parcelOwner.get(it.orderId);
    if (!parcel) continue; // посылка не мигрирована (не должно быть)
    const prod = productById.get(it.productId);
    orderData.push({
      id: id(), customerId: parcel.customerId, recipientId: parcel.recipientId,
      deliveryType: mapDelivery(prod?.deliveryType),
      productNameText: it.name || prod?.name || "Товар",
      trackNumber: firstTrackByProduct.get(it.productId) || null,
      quantity: it.quantity || 1,
      unitPriceUsd: D(it.price),
      declaredValueUsd: D(it.declaredValueUsd),
      actualWeightKg: D(it.weightKg) ?? D(prod?.actualWeightKg),
      volumetricWeightKg: D(prod?.volumetricWeightKg),
      status: "FORMED", parcelId: it.orderId,
      createdAt: parcel.createdAt,
    });
  }
  // 5b. товары вне посылок
  for (const prod of products) {
    if (prod.deletedAt) continue;
    if (productsInParcel.has(prod.id)) continue;
    const owner = resolveOwner(prod.customerId);
    orderData.push({
      id: id(), customerId: owner.customerId, recipientId: owner.recipientId,
      deliveryType: mapDelivery(prod.deliveryType),
      productNameText: prod.name || "Товар",
      trackNumber: firstTrackByProduct.get(prod.id) || null,
      quantity: prod.stock || 1,
      unitPriceUsd: D(prod.price),
      actualWeightKg: D(prod.actualWeightKg),
      volumetricWeightKg: D(prod.volumetricWeightKg),
      status: "NEW", parcelId: null,
      createdAt: dt(prod.createdAt),
    });
  }
  // вставка пачками
  for (let i = 0; i < orderData.length; i += 200) {
    await prisma.order.createMany({ data: orderData.slice(i, i + 200) });
  }
  log("Order (строки):", orderData.length, "(из позиций:", items.length, "+ вне посылок:", orderData.length - items.length, ")");

  // ───────── 6. ИСТОРИЯ СТАТУСОВ ПОСЫЛОК ─────────
  const hist = all(src, "SELECT * FROM OrderStatusHistory");
  const userIds = new Set(users.map((u) => u.id));
  const fallbackUser = users[0]?.id;
  const histData = hist
    .filter((h) => parcelOwner.has(h.orderId))
    .map((h) => ({
      id: h.id, parcelId: h.orderId, status: PARCEL_STATUS[h.status] || "FORMED",
      changedBy: userIds.has(h.changedBy) ? h.changedBy : fallbackUser,
      note: h.note, createdAt: dt(h.createdAt),
    }))
    .filter((h) => h.changedBy);
  for (let i = 0; i < histData.length; i += 200) {
    await prisma.parcelStatusHistory.createMany({ data: histData.slice(i, i + 200) });
  }
  log("ParcelStatusHistory:", histData.length);

  await prisma.$disconnect();
  src.close();
  dev.close();
  log("\n✅ Миграция завершена.");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
