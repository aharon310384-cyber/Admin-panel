import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/statuses";
import OrderForm from "@/components/orders/order-form";
import { serviceHints } from "@/lib/tariffs";
import { catalogItemOptions } from "@/lib/products";
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

  // Остальные товары той же коробки — заказы с тем же входящим треком (без разницы в регистре).
  const track = order.trackNumber?.trim() || null;
  const sameTrack = track
    ? await prisma.order.findMany({
        where: { id: { not: order.id }, deletedAt: null, trackNumber: { equals: track, mode: "insensitive" } },
        select: { id: true, number: true, productNameText: true, quantity: true, status: true, customer: { select: { code: true } } },
        orderBy: [{ createdAt: "asc" }, { number: "asc" }],
      })
    : [];

  const createdAtLabel = formatDateTime(order.createdAt);
  const authorLabel = order.author?.name ?? "—";

  const [customers, recipients, productNames, deliveryMethods, hints] = await Promise.all([
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
    catalogItemOptions(),
    prisma.deliveryMethod.findMany({
      where: { active: true },
      select: { code: true, nameRu: true },
      orderBy: { sortOrder: "asc" },
    }),
    serviceHints(),
  ]);

  const update = updateOrder.bind(null, id);

  return (
    <>
      <Form
        formKey="order-edit"
        title="Редактирование заказа"
        guid={order.id}
        commands={
          <>
            {track && (
              <Link href={`/orders/new?from=${order.id}`} className="cmd" data-command="add-to-track" title="Новый заказ с тем же треком, клиентом и получателем">
                <Plus size={15} /> Товар в этот трек
              </Link>
            )}
            <span data-command="remove" data-label="Удалить">
              <DeleteOrderButton productId={id} deleteAction={deleteOrder} />
            </span>
          </>
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
        footer={<>Один заказ = один товар + один входящий трек-номер; несколько товаров в коробке — заказы с одним треком</>}
      >
        {sameTrack.length > 0 && (
          <div className="card same-track">
            <h2 className="same-title">
              Ещё в этом треке <span className="mono">{track}</span> · {sameTrack.length}
            </h2>
            <ul className="same-list">
              {sameTrack.map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}/edit`} className="mono">{o.number ?? "без номера"}</Link>
                  <span>{o.productNameText || "—"}</span>
                  <span className="same-muted">{o.quantity} шт · {orderStatusLabel(o.status)}{o.customer.code ? ` · ${o.customer.code}` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="card">
          <OrderForm
            customers={customers}
            recipients={recipients}
            productNames={productNames}
            deliveryMethods={deliveryMethods}
            serviceHints={hints}
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
        .same-title { margin: 0 0 8px; font-size: 13.5px; font-weight: 600; }
        .same-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
        .same-list li { display: flex; flex-wrap: wrap; gap: 4px 12px; }
        .same-list a { color: var(--color-accent); text-decoration: none; }
        .same-list a:hover { text-decoration: underline; }
        .same-muted { color: var(--color-muted); }
        .mono { font-family: var(--font-mono); font-size: 12.5px; }
        .meta { display: flex; flex-wrap: wrap; gap: 10px; }
        .meta-item { display: flex; flex-direction: column; gap: 3px; padding: 8px 14px; background: color-mix(in oklch, var(--color-muted-bg) 40%, var(--color-surface)); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
        .meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); }
        .meta-value { font-size: 13.5px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
      `}</style>
    </>
  );
}
