// Начальный справочник наименований (группы → товары) — только в пустой справочник, например для новой компании.
// Заполненный справочник не трогает: дальше он правится в «Склад → Наименования товаров».
// Коды присваивает программа (lib/product-codes.ts): 000001, 000002… в порядке prisma/product-names-data.ts.
//
// Запуск: npm run product-names:import (база — DATABASE_URL из .env).

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { nextProductCode } from "../lib/product-codes";
import { PRODUCT_NAME_SECTIONS, PRODUCT_NAME_ITEM_COUNT } from "./product-names-data";

const prisma = new PrismaClient();

// Карта официальных описаний EU Combined Nomenclature 2026 (HS6 -> { desc, cn }).
// Источник: Finnish Customs «CN 2026 official texts», сверено сгенерированным скриптом.
type CnEntry = { desc: string; cn: string };
const CN_DESCRIPTIONS: Record<string, CnEntry> = JSON.parse(
  readFileSync(new URL("./eu-cn-descriptions.json", import.meta.url), "utf-8")
);

/** Официальное описание EU CN по HS-коду товара (пробелы игнорируются). */
function cnDescription(hs: string | undefined): string | null {
  if (!hs) return null;
  return CN_DESCRIPTIONS[hs.replace(/\s/g, "")]?.desc ?? null;
}

async function main() {
  const existing = await prisma.productName.count();
  if (existing > 0) {
    console.log(`Справочник уже заполнен (${existing} записей) — загрузка не нужна.`);
    return;
  }

  let groups = 0;
  let items = 0;

  for (const section of PRODUCT_NAME_SECTIONS) {
    // 1) Группа (верхний уровень).
    const group = await prisma.productName.create({
      data: {
        code: await nextProductCode(prisma),
        nameRu: section.ru,
        nameEn: section.en,
        nameCn: section.cn,
        isGroup: true,
      },
    });
    groups += 1;

    // 2) Товары группы.
    for (const item of section.items) {
      await prisma.productName.create({
        data: {
          code: await nextProductCode(prisma),
          nameRu: item.ru,
          nameEn: item.en,
          nameCn: item.cn,
          hsCode: item.hs,
          hsDescription: cnDescription(item.hs),
          parentId: group.id,
        },
      });
      items += 1;
    }
  }

  console.log(
    `Загружено: групп ${groups}, товаров ${items} (ожидалось ${PRODUCT_NAME_ITEM_COUNT}).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
