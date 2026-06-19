// Демо-данные для dev.db: клиенты, получатели, заказы разных статусов.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CUSTOMERS = [
  { code: "SM", name: "Светлана Морозова", phone: "+79161112233", city: "Москва" },
  { code: "AK", name: "Андрей Ковалёв", phone: "+79262223344", city: "Санкт-Петербург" },
  { code: "YN", name: "Юлия Нестерова", phone: "+79031114455", city: "Казань" },
];

const NAMES = ["Кепка", "Футболка", "Кроссовки", "Сумка", "Куртка", "Джинсы", "Ремень"];
const TRACKS = ["YT4521339001CN", "SF1882443120CN", "JD0099218833CN", "YT4521339002CN"];
const STATUSES = ["NEW", "IN_RECEIVING_QUEUE", "RECEIVED", "FORMED"];
const DELIVERY = ["AUTO", "AIR", "SEA", "EMS"];

function pick(a, i) { return a[i % a.length]; }

(async () => {
  for (const c of CUSTOMERS) {
    const customer = await prisma.customer.create({
      data: { code: c.code, name: c.name, phone: c.phone, city: c.city, country: "Россия" },
    });
    // 2 получателя на клиента
    const rcps = [];
    for (let r = 0; r < 2; r++) {
      const rec = await prisma.recipient.create({
        data: {
          customerId: customer.id,
          name: r === 0 ? c.name : `${c.name.split(" ")[0]} (родители)`,
          phone: c.phone,
          country: "Россия",
          city: c.city,
          address: `ул. Примерная, д. ${10 + r}`,
        },
      });
      rcps.push(rec);
    }
    // 4 заказа на клиента
    for (let o = 0; o < 4; o++) {
      const qty = 1 + (o % 3);
      const unit = 8 + o * 4;
      await prisma.order.create({
        data: {
          customerId: customer.id,
          recipientId: pick(rcps, o).id,
          deliveryType: pick(DELIVERY, o),
          productNameText: pick(NAMES, o + c.code.length),
          declaredValueUsd: unit * qty,
          trackNumber: pick(TRACKS, o),
          quantity: qty,
          unitPriceUsd: unit,
          actualWeightKg: 0.3 + o * 0.2,
          detailedCheckRequested: o === 1,
          status: pick(STATUSES, o),
        },
      });
    }
  }
  const counts = {
    customers: await prisma.customer.count(),
    recipients: await prisma.recipient.count(),
    orders: await prisma.order.count(),
  };
  console.log("DEMO OK:", JSON.stringify(counts));
  await prisma.$disconnect();
})().catch((e) => { console.error("DEMO ERR:", e.message); process.exit(1); });
