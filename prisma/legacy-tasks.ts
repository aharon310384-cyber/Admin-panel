import type { Prisma } from "@prisma/client";
import { parseLegacyParcelTaskNumber } from "../lib/document-numbers";

type LegacyParcel = {
  /** Номер строки из Excel целиком, например «AT1536DE 01 DHL». */
  rawNumber: string;
  customerId: string;
  createdAt: Date;
};

function uniqueNumber(base: string, used: Set<string>) {
  let number = base;
  for (let index = 2; used.has(number); index += 1) {
    number = `${base}-${index}`;
  }
  used.add(number);
  return number;
}

/**
 * Создаёт завершённую задачу на формирование посылки по номеру из Excel.
 * Приписки вроде «01 DHL» и исходный номер при совпадении попадают в примечание.
 * Возвращает null, если номер не в формате «код клиента + число + страна».
 */
export async function createLegacyParcelTask(
  tx: Prisma.TransactionClient,
  parcel: LegacyParcel,
  createdById: string,
  usedNumbers: Set<string>
) {
  const parsed = parseLegacyParcelTaskNumber(parcel.rawNumber);
  if (!parsed) return null;

  const number = uniqueNumber(parsed.number, usedNumbers);
  const keepRaw = parsed.tail !== null || number !== parsed.number;

  const task = await tx.parcelTask.create({
    data: {
      number,
      status: "COMPLETED",
      customerId: parcel.customerId,
      destinationCountry: parsed.country,
      note: keepRaw ? `Номер в Excel: ${parcel.rawNumber.trim()}` : null,
      createdById,
      createdAt: parcel.createdAt,
    },
  });

  return { task, sequence: parsed.sequence };
}

export function appendNote(notes: string | null, line: string) {
  return notes ? `${notes}\n${line}` : line;
}
