import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { slugify } from "../lib/utils";

const prisma = new PrismaClient();

type BookOrder = {
  sourceRow: number;
  sourceInfo: string | null;
  itemName: string | null;
};

type BookImport = {
  orders: BookOrder[];
};

function compact(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text.replace(/\s+/g, " ") : null;
}

function hash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function productSlug(name: string): string {
  const slug = slugify(name).slice(0, 60);
  return slug ? `${slug}-${hash(name)}` : `book2-${hash(name)}`;
}

async function loadImportRows(): Promise<Map<number, BookOrder>> {
  const importPath = path.join(process.cwd(), "Downloads", "book-2-import.json");
  const raw = await readFile(importPath, "utf8");
  const data = JSON.parse(raw.replace(/^\uFEFF/, "")) as BookImport;

  return new Map(data.orders.map((order) => [order.sourceRow, order]));
}

async function main() {
  const importRowsBySourceRow = await loadImportRows();
  const orders = await prisma.order.findMany({
    where: { deletedAt: null, sourceSheet: "ALL 6" },
    include: { items: { orderBy: { id: "asc" } } },
  });

  const productsByName = new Map<string, string>();
  let updatedItems = 0;
  let skippedRows = 0;
  let fallbackRows = 0;

  for (const order of orders) {
    const currentItem = order.items[0];
    const importRow = order.sourceRow ? importRowsBySourceRow.get(order.sourceRow) : undefined;
    if (!importRow) {
      skippedRows += 1;
      continue;
    }

    const itemName = compact(importRow.itemName);
    const name = itemName ?? compact(order.lr) ?? `Позиция ${order.number}`;
    if (!itemName) {
      fallbackRows += 1;
    }

    const sourceInfo = compact(importRow?.sourceInfo) ?? compact(order.sourceInfo) ?? compact(currentItem?.sourceInfo);
    const key = name.toLowerCase();
    const quantity = Math.max(1, order.packageCount ?? 1);
    const fallbackLineTotal = currentItem
      ? Number(currentItem.lineTotalUsd ?? Number(currentItem.price) * currentItem.quantity)
      : Number(order.totalUsd || order.total || 0);
    const lineTotalUsd = Number(order.insuranceUsd ?? fallbackLineTotal);
    const unitPriceUsd = lineTotalUsd / quantity;

    let productId = productsByName.get(key);
    if (!productId) {
      const existing = await prisma.product.findFirst({
        where: { name, sku: { startsWith: "BOOK2-" } },
        select: { id: true },
      });

      if (existing) {
        productId = existing.id;
        await prisma.product.update({
          where: { id: productId },
          data: {
            description: sourceInfo,
            price: unitPriceUsd,
            stock: 999,
            isActive: true,
            deletedAt: null,
          },
        });
      } else {
        const product = await prisma.product.create({
          data: {
            name,
            slug: productSlug(name),
            sku: `BOOK2-${hash(key).toUpperCase()}`,
            description: sourceInfo,
            price: unitPriceUsd,
            stock: 999,
            isActive: true,
          },
          select: { id: true },
        });
        productId = product.id;
      }

      productsByName.set(key, productId);
    }

    if (currentItem) {
      await prisma.orderItem.update({
        where: { id: currentItem.id },
        data: {
          productId,
          name,
          quantity,
          price: unitPriceUsd,
          lineTotalUsd,
          sourceInfo,
        },
      });
      updatedItems += 1;
    }
  }

  const orphanedProducts = await prisma.product.updateMany({
    where: {
      sku: { startsWith: "BOOK2-" },
      deletedAt: null,
      orderItems: { none: {} },
    },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  console.log(
    `Updated ${updatedItems} order items, used fallback for ${fallbackRows} blank item names, skipped ${skippedRows} rows, and archived ${orphanedProducts.count} orphaned products.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
