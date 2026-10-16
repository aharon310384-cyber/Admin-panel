// Обновление существующей базы под документооборот. Запускать один раз после `npm run db:push`:
//   npm run db:upgrade:document-flow
//
// 1. Заказы без номера получают номер ZK-000001… в порядке создания.
// 2. Каждая посылка без задачи получает задачу на формирование посылки: её прежний номер
//    (SM3956US, AT1536DE 01 DHL…) становится номером задачи, приписка — примечанием задачи.
//    Сама посылка получает номер PS-000001… в порядке создания.
// Всё в одной транзакции. Повторный запуск ничего не меняет.
import { PrismaClient, type ParcelStatus, type ParcelTaskStatus } from "@prisma/client";
import { isDocumentNumber, nextDocumentNumber } from "../lib/document-numbers";
import { splitLegacyTaskNumber } from "../lib/parcel-number";

const prisma = new PrismaClient();

// Статус задачи по статусу уже существующей посылки.
const TASK_STATUS_BY_PARCEL: Record<ParcelStatus, ParcelTaskStatus> = {
  FORMED: "NEW",
  ASSEMBLED: "ASSEMBLED",
  PACKED: "PACKED",
  READY_TO_SHIP: "COMPLETED",
  SHIPPED: "COMPLETED",
  DELIVERED: "COMPLETED",
  RETURNED: "CANCELED",
  UTILIZED: "CANCELED",
};

function uniqueNumber(base: string, used: Set<string>) {
  let number = base;
  for (let index = 2; used.has(number); index += 1) number = `${base}_${index}`;
  used.add(number);
  return number;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("В базе нет администратора: задачи создаются от его имени.");

  const orders = await prisma.order.findMany({
    where: { number: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const parcels = await prisma.parcel.findMany({
    where: { parcelTaskId: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      number: true,
      status: true,
      customerId: true,
      createdAt: true,
      deletedAt: true,
      recipient: { select: { countryCode: true } },
    },
  });
  const pending = parcels.filter((parcel) => !isDocumentNumber("parcel", parcel.number));

  if (orders.length === 0 && pending.length === 0) {
    console.log("Обновлять нечего: у всех заказов есть номера, у всех посылок — задачи.");
    return;
  }

  const existingTasks = await prisma.parcelTask.findMany({ select: { number: true } });
  const usedTaskNumbers = new Set(existingTasks.map((task) => task.number));
  let renamed = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const order of orders) {
        await tx.order.update({
          where: { id: order.id },
          data: { number: await nextDocumentNumber(tx, "order") },
        });
      }

      for (const parcel of pending) {
        const legacy = parcel.number.trim();
        const split = splitLegacyTaskNumber(legacy);
        const taskNumber = uniqueNumber(split.number, usedTaskNumbers);
        if (taskNumber !== legacy) renamed += 1;

        const task = await tx.parcelTask.create({
          data: {
            number: taskNumber,
            status: TASK_STATUS_BY_PARCEL[parcel.status],
            customerId: parcel.customerId,
            destinationCountry: parcel.recipient?.countryCode?.toUpperCase() ?? split.country,
            note: taskNumber !== legacy ? `Номер в Excel: ${legacy}` : null,
            createdById: admin.id,
            createdAt: parcel.createdAt,
            deletedAt: parcel.deletedAt,
          },
        });
        await tx.parcel.update({
          where: { id: parcel.id },
          data: { number: await nextDocumentNumber(tx, "parcel"), parcelTaskId: task.id },
        });
        await tx.order.updateMany({
          where: { parcelId: parcel.id },
          data: { parcelTaskId: task.id },
        });
      }
    },
    { maxWait: 60_000, timeout: 30 * 60_000 }
  );

  console.log(`Заказам выдано номеров ZK: ${orders.length}.`);
  console.log(`Посылкам создано задач и выдано номеров PS: ${pending.length}.`);
  console.log(`Из них номер задачи отличается от прежнего (приписка или дубль — см. примечание задачи): ${renamed}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
