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
  });

  if (!order) notFound();

  const [customers, recipients] = await Promise.all([
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

      <div className="card">
        <OrderForm
          customers={customers}
          recipients={recipients}
          action={update}
          submitLabel="Сохранить изменения"
          initial={{
            customerId: order.customerId,
            recipientId: order.recipientId,
            deliveryType: order.deliveryType,
            productNameText: order.productNameText ?? "",
            trackNumber: order.trackNumber,
            quantity: order.quantity,
            unitPriceUsd: order.unitPriceUsd != null ? Number(order.unitPriceUsd) : null,
            actualWeightKg: order.actualWeightKg != null ? Number(order.actualWeightKg) : null,
            detailedCheckRequested: order.detailedCheckRequested,
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
      `}</style>
    </div>
  );
}
