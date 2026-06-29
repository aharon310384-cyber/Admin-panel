import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { orderStatusLabel } from "@/lib/statuses";
import ReceivingArm from "@/components/receiving/receiving-arm";

export const metadata: Metadata = { title: "АРМ приём заказа" };

export default async function ReceivingPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const { track } = await searchParams;
  const trackQuery = track?.trim();

  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      status: { in: ["NEW", "IN_RECEIVING_QUEUE"] },
      ...(trackQuery ? { trackNumber: { contains: trackQuery } } : {}),
    },
    include: { customer: { select: { name: true, code: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const rows = orders.map((o) => ({
    id: o.id,
    productNameText: o.productNameText,
    trackNumber: o.trackNumber,
    quantity: o.quantity,
    customerName: o.customer.name,
    customerCode: o.customer.code,
    statusLabel: orderStatusLabel(o.status),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">АРМ приём заказа</h1>
          <p className="page-subtitle">Заказы, ожидающие приёма на склад — {rows.length}</p>
        </div>
      </div>

      <form className="search-wrap" method="get">
        <input
          type="search"
          name="track"
          placeholder="Поиск по трек-номеру…"
          defaultValue={trackQuery ?? ""}
          className="search-input"
        />
      </form>

      <div className="card">
        <ReceivingArm rows={rows} />
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 16px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }
        .search-wrap { max-width: 420px; }
        .search-input { width: 100%; padding: 9px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); outline: none; }
        .search-input:focus { border-color: var(--color-accent); }
        .card { padding: 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
      `}</style>
    </div>
  );
}
