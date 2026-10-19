import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import OrderForm from "@/components/orders/order-form";
import { updateOrder, deleteOrder } from "@/actions/orders";
import DeleteOrderButton from "./[id]/edit/delete-order-button";
import Form from "@/components/form/form";

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

  const [customers, recipients, productNames, deliveryMethods] = await Promise.all([
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
    prisma.deliveryMethod.findMany({
      where: { active: true },
      select: { code: true, nameRu: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const update = updateOrder.bind(null, id);

  return (
    <>
      <Form
        formKey="order-edit"
        title="Редактирование заказа"
        guid={order.id}
        commands={
          <span data-command="remove" data-label="Удалить">
            <DeleteOrderButton productId={id} deleteAction={deleteOrder} />
          </span>
        }
        header={
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
        }
        footer={<>Один заказ = один товар + один входящий трек-номер</>}
      >
        <div className="card">
          <OrderForm
            customers={customers}
            recipients={recipients}
            productNames={productNames}
            deliveryMethods={deliveryMethods}
            action={update}
            submitLabel="Сохранить изменения"
            initial={{
              customerId: order.customerId,
              recipientId: order.recipientId,
              deliveryType: order.deliveryType,
              productNameText: order.productNameText ?? "",
              trackNumber: order.trackNumber,
              customerComment: order.customerComment,
              internalComment: order.internalComment,
              quantity: order.quantity,
              unitPriceUsd: order.unitPriceUsd != null ? Number(order.unitPriceUsd) : null,
              actualWeightKg: order.actualWeightKg != null ? Number(order.actualWeightKg) : null,
              detailedCheckRequested: order.detailedCheckRequested,
              keepOriginalPackaging: order.keepOriginalPackaging,
              consolidationRequested: order.consolidationRequested,
              compactPackRequested: order.compactPackRequested,
              standardCheckRequested: order.standardCheckRequested,
              reinforcedPackRequested: order.reinforcedPackRequested,
            }}
          />
        </div>
      </Form>

      <style>{`
        .card { margin-top: 8px; padding: 14px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
        .meta { display: flex; flex-wrap: wrap; gap: 10px; }
        .meta-item { display: flex; flex-direction: column; gap: 3px; padding: 8px 14px; background: color-mix(in oklch, var(--color-muted-bg) 40%, var(--color-surface)); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
        .meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); }
        .meta-value { font-size: 13.5px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
      `}</style>
    </>
  );
}
