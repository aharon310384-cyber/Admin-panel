import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";
import { deliveryTypeLabel } from "@/lib/statuses";
import FormFromOrders from "@/components/parcels/form-from-orders";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Оформить посылку" };

export default async function FromOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ orderIds?: string }>;
}) {
  const { orderIds } = await searchParams;
  const preselected = (orderIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const orders = await prisma.order.findMany({
    where: { deletedAt: null, status: "RECEIVED" },
    include: { customer: { select: { name: true, code: true } }, recipient: { select: { name: true } } },
    orderBy: [{ customerId: "asc" }, { createdAt: "asc" }],
    take: 300,
  });

  const rows = orders.map((o) => ({
    id: o.id,
    productNameText: o.productNameText,
    trackNumber: o.trackNumber,
    quantity: o.quantity,
    weight: formatNumber(Number(o.actualWeightKg ?? 0)),
    customerId: o.customerId,
    customerName: o.customer.name,
    customerCode: o.customer.code,
    recipientName: o.recipient?.name ?? null,
    deliveryType: o.deliveryType ? deliveryTypeLabel(o.deliveryType) : null,
  }));

  return (
    <>
      <Form
        formKey="parcels-from-orders"
        title="Оформить посылку"
        footer="Выберите принятые заказы одного клиента → соберём в посылку с расчётом"
      >
        <div className="card">
          <FormFromOrders rows={rows} preselected={preselected} />
        </div>
      </Form>

      <style>{`
        .card { margin-top: 8px; padding: 14px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
      `}</style>
    </>
  );
}
