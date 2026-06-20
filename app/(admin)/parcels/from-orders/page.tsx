import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";
import { deliveryTypeLabel } from "@/lib/statuses";
import FormFromOrders from "@/components/parcels/form-from-orders";

export const metadata: Metadata = { title: "Оформить посылку" };

export default async function FromOrdersPage() {
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
    <div className="page">
      <Link href="/parcels" className="back"><ArrowLeft size={16} /> К посылкам</Link>
      <h1 className="page-title">Оформить посылку</h1>
      <p className="page-subtitle">Выберите принятые заказы одного клиента → соберём в посылку с расчётом</p>

      <div className="card">
        <FormFromOrders rows={rows} />
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 12px; max-width: 820px; }
        .back { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; font-size: 13px; font-weight: 600; color: var(--color-accent); text-decoration: none; }
        .page-title { font-size: 24px; font-weight: 700; margin: 6px 0 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 0; }
        .card { margin-top: 8px; padding: 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
      `}</style>
    </div>
  );
}
