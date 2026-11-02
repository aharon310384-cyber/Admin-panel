import "server-only";

import type { Buyout, Prisma } from "@prisma/client";
import { nextDocumentNumber } from "@/lib/document-numbers";
import { recordVersion } from "@/lib/versions";
import { round2 } from "@/lib/buyout-money";

// Заказ из выкупа (docs/product/задание-выкуп.md, раздел 4): менеджер вписал трек продавца — программа создаёт
// заказ ZK-… с клиентом, товаром, количеством, ценой, ссылкой, фото и треком. Дальше — обычный путь склада.

/** Фото товара для заказа: картинка из общих загрузок (/uploads/…), как у остальных заказов. */
export function publicPhotoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return /^\/uploads\/[\w./-]+\.(jpe?g|png|webp|gif)$/i.test(url) && !url.includes("..") ? url : null;
}

export async function createOrderFromBuyout(
  tx: Prisma.TransactionClient,
  buyout: Buyout,
  { authorId, rateCnyPerUsd }: { authorId: string | null; rateCnyPerUsd: number | null }
) {
  const unitCny = buyout.unitPriceCny != null ? Number(buyout.unitPriceCny) : null;
  const unitUsd = unitCny != null && rateCnyPerUsd ? round2(unitCny / rateCnyPerUsd) : null;
  const order = await tx.order.create({
    data: {
      number: await nextDocumentNumber(tx, "order"),
      customerId: buyout.customerId,
      productNameText: buyout.productName,
      quantity: buyout.quantity,
      unitPriceCny: unitCny,
      unitPriceUsd: unitUsd,
      declaredValueUsd: unitUsd != null ? round2(unitUsd * buyout.quantity) : null,
      trackNumber: buyout.sellerTrack,
      productUrl: buyout.url,
      imageUrl: publicPhotoUrl(buyout.photoUrl),
      customerComment: [buyout.variant ? `Вариант: ${buyout.variant}` : null, buyout.customerComment].filter(Boolean).join("\n") || null,
      internalComment: `Из выкупа ${buyout.number}`,
      status: "NEW",
      authorId,
    },
  });
  await recordVersion("order", order.id, { authorId, comment: `Создан из выкупа ${buyout.number}` }, tx);
  return order;
}
