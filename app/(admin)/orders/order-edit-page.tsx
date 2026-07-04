import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import OrderForm from "@/components/orders/order-form";
import { updateOrder, deleteOrder } from "@/actions/orders";
import DeleteOrderButton from "./[id]/edit/delete-order-button";

export type OrderEditPageProps = {
  params: Promise<{ id: string }>;
};

export async function OrderEditPage({ params }: OrderEditPageProps) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/orders");

  const order = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    include: { author: { select: { name: true } } },
  });

  if (!order) notFound();

  const createdAtLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(order.createdAt);
  const authorLabel = order.author?.name ?? "—";

  const [customers, recipients, productNames] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.recipient.findMany({
      where: { deletedAt: null },
      select: { id: true, customerId: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.productName.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, nameRu: true, category: true, hsCode: true },
      orderBy: { nameRu: "asc" },
    }),
  ]);

  const update = updateOrder.bind(null, id);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link href="/orders" className="back">
            <ArrowLeft size={16} />
            К заказам
          </Link>
          <h1 className="page-title">Редактирование заказа</h1>
          <p className="page-subtitle">Один заказ = один товар + один трек-номер</p>
        </div>
        <DeleteOrderButton productId={id} deleteAction={deleteOrder} />
      </div>

      <div className="meta">
        <div className="meta-item">
          <span className="meta-label">Дата создания</span>
          <span className="meta-value">{createdAtLabel}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Автор</span>
          <span className="meta-value">{authorLabel}</span>
        </div>
      </div>

      <div className="card">
        <OrderForm
          customers={customers}
          recipients={recipients}
          productNames={productNames}
          action={update}
          submitLabel="Сохранить изменения"
          initial={{
            customerId: order.customerId,
            recipientId: order.recipientId,
            deliveryType: order.deliveryType,
            productNameText: order.productNameText ?? "",
            trackNumber: order.trackNumber,
            customerComment: order.customerComment,
            quantity: order.quantity,
            unitPriceUsd: order.unitPriceUsd != null ? Number(order.unitPriceUsd) : null,
            actualWeightKg: order.actualWeightKg != null ? Number(order.actualWeightKg) : null,
            detailedCheckRequested: order.detailedCheckRequested,
            keepOriginalPackaging: order.keepOriginalPackaging,
          }}
        />
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 12px; max-width: 720px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--color-accent); text-decoration: none; }
        .page-title { font-size: 24px; font-weight: 700; margin: 6px 0 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 0; }
        .card { margin-top: 8px; padding: 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
        .meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
        .meta-item { display: flex; flex-direction: column; gap: 3px; padding: 8px 14px; background: color-mix(in oklch, var(--color-muted-bg) 40%, var(--color-surface)); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
        .meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); }
        .meta-value { font-size: 13.5px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}
