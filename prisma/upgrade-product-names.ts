// Справочник наименований: разделы становятся группами (папками), как в 1С (решение владельца 2026-10-26).
// 1) Если групп ещё нет — группой становится каждая запись, в которой лежат другие записи,
//    и раздел без товаров (верхний уровень, код на 0000, без HS-кода). Дальше группы создаются только в справочнике.
// 2) Записи из удалённых групп поднимаются на верхний уровень — иначе их не видно в списке.
// Запускается при деплое (npm run db:upgrade) и вручную: npm run db:upgrade:product-names. Повторный запуск ничего не меняет.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let groups = 0;
  if ((await prisma.productName.count({ where: { isGroup: true } })) === 0) {
    const result = await prisma.productName.updateMany({
      where: {
        OR: [
          { children: { some: {} } },
          { parentId: null, hsCode: null, code: { endsWith: "0000" } },
        ],
      },
      data: { isGroup: true },
    });
    groups = result.count;
  }

  const lifted = await prisma.productName.updateMany({
    where: { deletedAt: null, parent: { is: { deletedAt: { not: null } } } },
    data: { parentId: null },
  });

  console.log(`Наименования: групп отмечено ${groups}, поднято из удалённых групп ${lifted.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
