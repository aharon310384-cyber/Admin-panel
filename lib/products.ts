import "server-only";

import { prisma } from "@/lib/prisma";

/** Справочные поля наименования (id/HS/секция) по выбранному из каталога productNameId. */
export async function resolveProductCatalog(productNameId: string | undefined | null) {
  if (!productNameId) return null;
  return prisma.productName.findFirst({
    where: { id: productNameId, deletedAt: null },
    select: { id: true, nameRu: true, category: true, hsCode: true },
  });
}
