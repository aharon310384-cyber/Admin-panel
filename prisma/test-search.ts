import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("== /orders (Product) search ==");
  const ordersSearch = "OS";
  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: ordersSearch } },
        { comments: { contains: ordersSearch } },
        { sku: { contains: ordersSearch } },
        { slug: { contains: ordersSearch } },
        { trackItems: { some: { trackNumber: { contains: ordersSearch } } } },
        { trackItems: { some: { name: { contains: ordersSearch } } } },
      ],
    },
    take: 3,
    select: { id: true, sku: true, name: true },
  });
  console.log(`Found: ${orders.length}`, orders);

  console.log("\n== /parcels (Order) search ==");
  const parcelsSearch = "OS4057PL";
  const parcels = await prisma.parcel.findMany({
    where: {
      deletedAt: null,
      OR: [
        { number: { contains: parcelsSearch } },
        { customer: { name: { contains: parcelsSearch } } },
        { recipientName: { contains: parcelsSearch } },
        { parcelNumber: { contains: parcelsSearch } },
      ],
    },
    take: 3,
    select: { id: true, number: true, recipientName: true },
  });
  console.log(`Found: ${parcels.length}`, parcels);

  console.log("\n== /recipients (Customer) search ==");
  const recSearch = "ivan";
  const recipients = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      OR: [
        { clientCode: { contains: recSearch } },
        { name: { contains: recSearch } },
        { lastName: { contains: recSearch } },
        { firstName: { contains: recSearch } },
        { middleName: { contains: recSearch } },
        { phone: { contains: recSearch } },
        { country: { contains: recSearch } },
        { city: { contains: recSearch } },
        { postalCode: { contains: recSearch } },
        { address: { contains: recSearch } },
      ],
    },
    take: 3,
    select: { id: true, name: true, code: true, country: true },
  });
  console.log(`Found: ${recipients.length}`, recipients);

  console.log("\n== /clients search ==");
  const clientSearch = "DT";
  const clients = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      code: { not: null },
      OR: [
        { code: { contains: clientSearch } },
        { name: { contains: clientSearch } },
        { phone: { contains: clientSearch } },
        { username: { contains: clientSearch } },
        { email: { contains: clientSearch } },
        { country: { contains: clientSearch } },
        { city: { contains: clientSearch } },
      ],
    },
    take: 3,
    select: { id: true, code: true, name: true },
  });
  console.log(`Found: ${clients.length}`, clients);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("ERROR:", e);
    prisma.$disconnect();
    process.exit(1);
  });
