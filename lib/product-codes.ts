import type { Prisma, PrismaClient } from "@prisma/client";

// Код записи справочника наименований — порядковый номер без префикса компании: 000001, 000002…
// Как в 1С: программа присваивает его при создании, в карточке его можно поправить (решение владельца 2026-10-26).
// Группы и товары — в одной нумерации. Счётчик — строка «ProductName» в DocumentCounter, как у номеров документов.

type Db = PrismaClient | Prisma.TransactionClient;

const COUNTER = "ProductName";
const CODE_DIGITS = 6;

/**
 * Следующий свободный код. Номер, уже занятый вручную введённым кодом, пропускается.
 * Вызывать в той же транзакции, где создаётся запись.
 */
export async function nextProductCode(db: Db): Promise<string> {
  for (;;) {
    const counter = await db.documentCounter.upsert({
      where: { prefix: COUNTER },
      create: { prefix: COUNTER, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    });
    const code = String(counter.lastValue).padStart(CODE_DIGITS, "0");
    const taken = await db.productName.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
}
