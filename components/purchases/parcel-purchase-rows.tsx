import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/utils";
import { round2, yuan } from "@/lib/purchase-money";

// Строка «Закупка» в квитанции посылки: покупки её заказов (docs/product/задание-выкуп.md, раздел 5).
// По каждой строке покупки в посылке — товар, доставка по Китаю и доля комиссии. Клиент заплатил это с баланса
// при покупке — сумма показывается для сведения и в ИТОГО посылки не входит.
export default async function ParcelPurchaseRows({ orderIds, rate }: { orderIds: string[]; rate: number }) {
  if (!orderIds.length) return null;
  const lines = await prisma.purchaseLine.findMany({
    where: { orderId: { in: orderIds }, status: { notIn: ["REJECTED", "RETURNED"] }, purchase: { deletedAt: null } },
    include: { purchase: { select: { number: true, goodsCny: true, commissionCny: true } } },
  });
  if (!lines.length) return null;
  const cny = round2(
    lines.reduce((sum, l) => {
      const goods = Number(l.unitPriceCny ?? 0) * l.quantity;
      const allGoods = Number(l.purchase.goodsCny ?? 0);
      const share = allGoods > 0 ? (Number(l.purchase.commissionCny ?? 0) * goods) / allGoods : 0;
      return sum + goods + Number(l.chinaDeliveryCny ?? 0) + share;
    }, 0)
  );
  const numbers = [...new Set(lines.map((l) => l.purchase.number))];
  return (
    <tr className="muted" title="Оплачено с баланса при покупке — в ИТОГО посылки не входит">
      <td>Закупка — покупка {numbers.join(", ")} (оплачено с баланса)</td>
      <td className="r">{rate > 0 ? formatUsd(cny / rate) : "—"}</td>
      <td className="r muted">{yuan(cny)}</td>
    </tr>
  );
}
