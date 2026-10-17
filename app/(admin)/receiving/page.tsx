import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { orderStatusLabel } from "@/lib/statuses";
import ReceivingArm from "@/components/receiving/receiving-arm";
import Form from "@/components/form/form";

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
      ...(trackQuery ? { trackNumber: { contains: trackQuery, mode: "insensitive" } } : {}),
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
    <>
      <Form
        formKey="receiving"
        title="АРМ приём заказа"
        header={
          <form className="search-wrap" method="get">
            <input
              type="search"
              name="track"
              placeholder="Поиск по входящему трек-номеру…"
              defaultValue={trackQuery ?? ""}
              className="search-input"
            />
          </form>
        }
        footer={<>Заказы, ожидающие приёма на склад — {rows.length}</>}
      >
        <div className="card">
          <ReceivingArm rows={rows} />
        </div>
      </Form>

      <style>{`
        .search-wrap { flex: 1; max-width: 420px; }
        .search-input { width: 100%; padding: 9px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); outline: none; }
        .search-input:focus { border-color: var(--color-accent); }
        .card { padding: 14px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
      `}</style>
    </>
  );
}
