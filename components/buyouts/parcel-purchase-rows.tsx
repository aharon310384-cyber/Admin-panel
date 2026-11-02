import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/utils";
import { yuan } from "@/lib/buyout-money";

// Строка «Закупка» в квитанции посылки: выкупы её заказов (docs/product/задание-выкуп.md, раздел 3).
// Выкуп клиент уже оплатил с баланса — сумма показывается для сведения и в ИТОГО посылки не входит.
export default async function ParcelPurchaseRows({ orderIds, rate }: { orderIds: string[]; rate: number }) {
  if (!orderIds.length) return null;
  const buyouts = await prisma.buyout.findMany({
    where: { orderId: { in: orderIds }, deletedAt: null, status: { notIn: ["REJECTED", "CANCELED", "RETURNED"] }, totalCny: { not: null } },
    select: { number: true, totalCny: true },
    orderBy: { number: "asc" },
  });
  if (!buyouts.length) return null;
  const cny = buyouts.reduce((sum, b) => sum + Number(b.totalCny), 0);
  return (
    <tr className="muted" title="Оплачено с баланса при выкупе — в ИТОГО посылки не входит">
      <td>Закупка — выкуп {buyouts.map((b) => b.number).join(", ")} (оплачено с баланса)</td>
      <td className="r">{rate > 0 ? formatUsd(cny / rate) : "—"}</td>
      <td className="r muted">{yuan(cny)}</td>
    </tr>
  );
}
