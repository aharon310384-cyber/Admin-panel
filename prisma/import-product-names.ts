// Импорт большого справочника наименований (секции → позиции) в ProductName.
// Идемпотентно (upsert по code). Секция = PF-СС0000 (parentId null),
// позиция = PF-СС{seq:0000} (parentId = id секции, category = nameRu секции).
//
// Запуск: npm run product-names:import
// БД берётся из DATABASE_URL (.env). Для прод-базы:
//   DATABASE_URL="file:../data/postmanfox.db" npm run product-names:import

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PRODUCT_NAME_SECTIONS, PRODUCT_NAME_ITEM_COUNT } from "./product-names-data";

const prisma = new PrismaClient();

// Карта официальных описаний EU Combined Nomenclature 2026 (HS6 -> { desc, cn }).
// Источник: Finnish Customs «CN 2026 official texts», сверено сгенерированным скриптом.
type CnEntry = { desc: string; cn: string };
const CN_DESCRIPTIONS: Record<string, CnEntry> = JSON.parse(
  readFileSync(new URL("./eu-cn-descriptions.json", import.meta.url), "utf-8")
);

/** Официальное описание EU CN по HS-коду позиции (пробелы игнорируются). */
function cnDescription(hs: string | undefined): string | null {
  if (!hs) return null;
  return CN_DESCRIPTIONS[hs.replace(/\s/g, "")]?.desc ?? null;
}

/** Код позиции: PF-СС{seq:0000}. Из кода секции берём двузначный префикс секции. */
function itemCode(sectionCode: string, seq: number): string {
  const section2 = sectionCode.slice(3, 5); // "PF-07" -> "07"
  return `PF-${section2}${String(seq).padStart(4, "0")}`;
}

async function main() {
  let sections = 0;
  let items = 0;

  for (const section of PRODUCT_NAME_SECTIONS) {
    // 1) Секция (верхний уровень).
    const parent = await prisma.productName.upsert({
      where: { code: section.code },
      update: {
        nameRu: section.ru,
        nameEn: section.en,
        nameCn: section.cn,
        category: null,
        parentId: null,
        deletedAt: null,
      },
      create: {
        code: section.code,
        nameRu: section.ru,
        nameEn: section.en,
        nameCn: section.cn,
      },
    });
    sections += 1;

    // 2) Позиции секции.
    for (const item of section.items) {
      await prisma.productName.upsert({
        where: { code: itemCode(section.code, item.seq) },
        update: {
          nameRu: item.ru,
          nameEn: item.en,
          nameCn: item.cn,
          hsCode: item.hs,
          hsDescription: cnDescription(item.hs),
          category: section.ru,
          parentId: parent.id,
          deletedAt: null,
        },
        create: {
          code: itemCode(section.code, item.seq),
          nameRu: item.ru,
          nameEn: item.en,
          nameCn: item.cn,
          hsCode: item.hs,
          hsDescription: cnDescription(item.hs),
          category: section.ru,
          parentId: parent.id,
        },
      });
      items += 1;
    }
  }

  console.log(
    `Импортировано: секций ${sections}, позиций ${items} (ожидалось ${PRODUCT_NAME_ITEM_COUNT}).`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
