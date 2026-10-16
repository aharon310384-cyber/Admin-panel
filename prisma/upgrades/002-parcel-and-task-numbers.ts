// Перенумерация посылок и задачи из номеров Excel для уже существующей базы.
// Запускать после 001 и `npm run db:push`:
//   npm run db:upgrade:002
//
// Каждая посылка получает номер PS-000001…, номер из Excel (AT1536DE) переходит
// в новую завершённую задачу на формирование посылки. Если номер не разбирается,
// он сохраняется в примечании посылки. Повторный запуск ничего не меняет.
import { PrismaClient } from "@prisma/client";
import { nextDocumentNumber, raiseParcelTaskCounter } from "../../lib/document-numbers";
import { appendNote, createLegacyParcelTask } from "../legacy-tasks";

const prisma = new PrismaClient();
const NEW_PARCEL_NUMBER = /^PS-\d+$/;

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    throw new Error("В базе нет администратора: задачи создаются от его имени.");
  }

  const parcels = await prisma.parcel.findMany({
    where: { parcelTaskId: null },
    select: { id: true, number: true, customerId: true, createdAt: true, notes: true, sourceRow: true },
  });
  // Порядок строк Excel, затем записи, созданные в админке.
  const pending = parcels
    .filter((parcel) => !NEW_PARCEL_NUMBER.test(parcel.number))
    .sort(
      (a, b) =>
        (a.sourceRow ?? Infinity) - (b.sourceRow ?? Infinity) ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id)
    );

  if (pending.length === 0) {
    console.log("Обновлять нечего: все посылки уже с номерами PS-.");
    return;
  }

  const existingTasks = await prisma.parcelTask.findMany({ select: { number: true } });
  const usedTaskNumbers = new Set(existingTasks.map((task) => task.number));
  let maxTaskSequence = 0;
  let withTask = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const parcel of pending) {
        const number = await nextDocumentNumber(tx, "parcel");
        const legacyTask = await createLegacyParcelTask(
          tx,
          { rawNumber: parcel.number, customerId: parcel.customerId, createdAt: parcel.createdAt },
          admin.id,
          usedTaskNumbers
        );

        if (legacyTask) {
          maxTaskSequence = Math.max(maxTaskSequence, legacyTask.sequence);
          withTask += 1;
          await tx.parcel.update({
            where: { id: parcel.id },
            data: { number, parcelTaskId: legacyTask.task.id },
          });
        } else {
          await tx.parcel.update({
            where: { id: parcel.id },
            data: { number, notes: appendNote(parcel.notes, `Прежний номер: ${parcel.number}`) },
          });
        }
      }

      await raiseParcelTaskCounter(tx, maxTaskSequence);
    },
    { maxWait: 60_000, timeout: 30 * 60_000 }
  );

  console.log(`Посылок перенумеровано: ${pending.length}.`);
  console.log(`Создано задач из номеров Excel: ${withTask}.`);
  console.log(`Номер не разобран, сохранён в примечании: ${pending.length - withTask}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
