// Справочник наименований: разделы становятся группами (папками), как в 1С (решение владельца 2026-10-26).
// 1) Если групп ещё нет — группой становится каждая запись, в которой лежат другие записи,
//    и раздел без товаров (верхний уровень, код на 0000, без HS-кода). Дальше группы создаются только в справочнике.
// 2) Записи из удалённых групп поднимаются на верхний уровень — иначе их не видно в списке.
// 3) Коды с префиксом PF- (PostmanFox) получают новые номера без префикса: 000001, 000002… (решение владельца 2026-10-26).
//    Порядок — по прежнему коду, поэтому группа и её товары идут подряд. Заказы ссылаются на запись, а не на код.
// 4) Начальный справочник (prisma/product-names-data.ts): пока ни в одной группе нет товаров — товары раскладываются
//    по группам (группа ищется по названию, нет такой — создаётся). Один раз и целиком: удалённые потом товары
//    не возвращаются. Так справочник заполнится и на сервере, и в базе новой компании (решение владельца 2026-10-28).
// Запускается при деплое (npm run db:upgrade) и вручную: npm run db:upgrade:product-names. Повторный запуск ничего не меняет.
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { nextProductCode } from "../lib/product-codes";
import { PRODUCT_NAME_SECTIONS } from "./product-names-data";

const prisma = new PrismaClient();

// Официальные описания EU Combined Nomenclature 2026: HS6 без пробелов → описание.
type CnEntry = { desc: string; cn: string };

// Название группы для сравнения: без учёта регистра, лишних пробелов и «ё».
const groupKey = (name: string) => name.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

async function loadStarterItems() {
  // считаются и удалённые: товары, которые уже были в группах, второй раз не раскладываются
  const inGroups = await prisma.productName.count({ where: { isGroup: false, parentId: { not: null } } });
  if (inGroups > 0) return null;

  const descriptions: Record<string, CnEntry> = JSON.parse(
    readFileSync(path.join(process.cwd(), "prisma/eu-cn-descriptions.json"), "utf-8")
  );
  return prisma.$transaction(
    async (tx) => {
      const groups: string[] = [];
      let items = 0;
      const existing = await tx.productName.findMany({
        where: { isGroup: true, deletedAt: null },
        select: { id: true, nameRu: true },
        orderBy: { createdAt: "asc" },
      });
      const groupIds = new Map<string, string>();
      for (const group of existing) if (!groupIds.has(groupKey(group.nameRu))) groupIds.set(groupKey(group.nameRu), group.id);

      for (const section of PRODUCT_NAME_SECTIONS) {
        let groupId = groupIds.get(groupKey(section.ru));
        if (!groupId) {
          const group = await tx.productName.create({
            data: { code: await nextProductCode(tx), nameRu: section.ru, nameEn: section.en, nameCn: section.cn, isGroup: true },
            select: { id: true },
          });
          groupId = group.id;
          groups.push(section.ru);
        }
        for (const item of section.items) {
          await tx.productName.create({
            data: {
              code: await nextProductCode(tx),
              nameRu: item.ru,
              nameEn: item.en,
              nameCn: item.cn,
              hsCode: item.hs,
              hsDescription: descriptions[item.hs.replace(/\s/g, "")]?.desc ?? null,
              parentId: groupId,
            },
          });
          items++;
        }
      }
      return { groups, items };
    },
    { timeout: 300_000 }
  );
}

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

  const oldCodes = await prisma.productName.findMany({
    where: { code: { startsWith: "PF-" } },
    select: { id: true },
    orderBy: { code: "asc" },
  });
  for (const { id } of oldCodes) {
    await prisma.productName.update({ where: { id }, data: { code: await nextProductCode(prisma) } });
  }

  const starter = await loadStarterItems();

  console.log(
    `Наименования: групп отмечено ${groups}, поднято из удалённых групп ${lifted.count}, новые коды вместо PF- — ${oldCodes.length}`
  );
  console.log(
    starter
      ? `Начальный справочник: товаров разложено по группам ${starter.items}, групп создано ${starter.groups.length}` +
          (starter.groups.length ? ` (${starter.groups.map((name) => `«${name}»`).join(", ")})` : "")
      : "Начальный справочник: не нужен — в группах уже есть товары"
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
