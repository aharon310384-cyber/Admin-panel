import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Справочник наименований — как «Номенклатура» в 1С: группы (папки) и товары внутри них.
// В заказ выбирается только товар; группа товара — по parentId, в заказ её название пишется снимком.

/** Товары справочника (без групп) — только они выбираются в заказе и уходят ИИ. */
export const CATALOG_ITEMS = { deletedAt: null, isGroup: false } satisfies Prisma.ProductNameWhereInput;

const ITEM_SELECT = {
  id: true,
  code: true,
  nameRu: true,
  hsCode: true,
  parent: { select: { nameRu: true } },
} satisfies Prisma.ProductNameSelect;

type ItemRow = Prisma.ProductNameGetPayload<{ select: typeof ITEM_SELECT }>;

function catalogItem({ parent, ...item }: ItemRow) {
  return { ...item, category: parent?.nameRu ?? null };
}

/** Товары для выбора в заказе: код, наименование, группа (category), HS-код. */
export async function catalogItemOptions() {
  const rows = await prisma.productName.findMany({
    where: CATALOG_ITEMS,
    select: ITEM_SELECT,
    orderBy: { nameRu: "asc" },
  });
  return rows.map(catalogItem);
}

/** Справочные поля товара (id/HS/группа) по выбранному из каталога productNameId. */
export async function resolveProductCatalog(productNameId: string | undefined | null) {
  if (!productNameId) return null;
  const row = await prisma.productName.findFirst({
    where: { ...CATALOG_ITEMS, id: productNameId },
    select: ITEM_SELECT,
  });
  return row && catalogItem(row);
}

/** Товар справочника по точному наименованию RU. */
export async function findCatalogItemByName(nameRu: string) {
  const row = await prisma.productName.findFirst({
    where: { ...CATALOG_ITEMS, nameRu },
    select: ITEM_SELECT,
  });
  return row && catalogItem(row);
}

export type ProductGroup = { id: string; nameRu: string };

/** Путь к группе от верхнего уровня: [«Одежда», «Детская»]. Пусто — такой группы нет или она удалена. */
export async function productGroupPath(groupId: string): Promise<ProductGroup[]> {
  const path: ProductGroup[] = [];
  let id: string | null = groupId;
  while (id && !path.some((group) => group.id === id)) {
    const group: (ProductGroup & { parentId: string | null }) | null = await prisma.productName.findFirst({
      where: { id, deletedAt: null, isGroup: true },
      select: { id: true, nameRu: true, parentId: true },
    });
    if (!group) break;
    path.unshift({ id: group.id, nameRu: group.nameRu });
    id = group.parentId;
  }
  return path;
}

export type ProductGroupOption = { id: string; label: string };

/** Группы деревом для выбора «В группе»: «Одежда», «Одежда / Детская»… Без exceptId и её подгрупп. */
export async function productGroupOptions(exceptId?: string): Promise<ProductGroupOption[]> {
  const groups = await prisma.productName.findMany({
    where: { deletedAt: null, isGroup: true },
    select: { id: true, nameRu: true, parentId: true },
    orderBy: { nameRu: "asc" },
  });
  const ids = new Set(groups.map((group) => group.id));
  const byParent = new Map<string | null, typeof groups>();
  for (const group of groups) {
    // группа в удалённой группе показывается на верхнем уровне
    const parentId = group.parentId && ids.has(group.parentId) ? group.parentId : null;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), group]);
  }

  const options: ProductGroupOption[] = [];
  const walk = (parentId: string | null, path: string) => {
    for (const group of byParent.get(parentId) ?? []) {
      if (group.id === exceptId) continue;
      const label = path ? `${path} / ${group.nameRu}` : group.nameRu;
      options.push({ id: group.id, label });
      walk(group.id, label);
    }
  };
  walk(null, "");
  return options;
}
