import "server-only";

import type { Prisma, Purchase, PurchaseLine } from "@prisma/client";
import { nextDocumentNumber } from "@/lib/document-numbers";
import { recordVersion } from "@/lib/versions";
import { round2 } from "@/lib/purchase-money";

// Заказ из строки покупки (docs/product/задание-выкуп.md, раздел 6): менеджер вписал трек продавца — программа создаёт
// заказ ZK-…: клиент, получатель, вид доставки и услуги — из шапки покупки; товар, количество, цена, ссылка, фото и
// трек — из строки. «Заказ = товар»: строки одного продавца с одним треком — несколько заказов с этим треком,
// склад принимает их одной коробкой (АРМ «Приём заказа»). Дальше — обычный путь склада.

/** Фото товара для заказа: картинка из общих загрузок (/uploads/…), как у остальных заказов. */
export function publicPhotoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return /^\/uploads\/[\w./-]+\.(jpe?g|png|webp|gif)$/i.test(url) && !url.includes("..") ? url : null;
}

export async function createOrderFromLine(
  tx: Prisma.TransactionClient,
  purchase: Purchase,
  line: PurchaseLine,
  { authorId, rateCnyPerUsd }: { authorId: string | null; rateCnyPerUsd: number | null }
) {
  const unitCny = line.unitPriceCny != null ? Number(line.unitPriceCny) : null;
  const unitUsd = unitCny != null && rateCnyPerUsd ? round2(unitCny / rateCnyPerUsd) : null;
  const turnkey = purchase.mode === "TURNKEY";
  const order = await tx.order.create({
    data: {
      number: await nextDocumentNumber(tx, "order"),
      customerId: purchase.customerId,
      recipientId: turnkey ? purchase.recipientId : null,
      deliveryType: turnkey ? purchase.deliveryType : null,
      productNameText: line.productName,
      quantity: line.quantity,
      unitPriceCny: unitCny,
      unitPriceUsd: unitUsd,
      declaredValueUsd: unitUsd != null ? round2(unitUsd * line.quantity) : null,
      trackNumber: line.sellerTrack,
      productUrl: line.url,
      imageUrl: publicPhotoUrl(line.photoUrl),
      customerComment: [line.variant ? `Вариант: ${line.variant}` : null, purchase.customerComment].filter(Boolean).join("\n") || null,
      internalComment: `Из покупки ${purchase.number}, строка ${line.lineNo}`,
      consolidationRequested: purchase.consolidationRequested,
      compactPackRequested: purchase.compactPackRequested,
      standardCheckRequested: purchase.standardCheckRequested,
      detailedCheckRequested: purchase.detailedCheckRequested,
      reinforcedPackRequested: purchase.reinforcedPackRequested,
      keepOriginalPackaging: purchase.keepOriginalPackaging,
      status: "NEW",
      authorId,
    },
  });
  await recordVersion("order", order.id, { authorId, comment: `Создан из покупки ${purchase.number}, строка ${line.lineNo}` }, tx);
  return order;
}
