import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dedupeCustomers } from "@/lib/customer-dedupe";
import OrderForm from "./order-form";
import { updateOrder, archiveOrder, deleteOrder } from "@/actions/orders";
import DeleteOrderButton from "./[id]/edit/delete-order-button";

export type OrderEditPageProps = {
  params: Promise<{ id: string }>;
};

export async function OrderEditPage({ params }: OrderEditPageProps) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/orders");

  const product = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    include: {
      trackItems: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!product) notFound();

  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      lastName: true,
      firstName: true,
      middleName: true,
      email: true,
      phone: true,
      code: true,
      clientCode: true,
      country: true,
      city: true,
      postalCode: true,
      address: true,
      informationDate: true,
      sourceRow: true,
    },
  });

  const update = updateOrder.bind(null, id);
  const productForForm = {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    customerId: product.customerId,
    deliveryType: product.deliveryType,
    comments: product.comments,
    description: product.description,
    price: Number(product.price),
    stock: product.stock,
    imageUrl: product.imageUrl,
    isActive: product.isActive,
    trackItems: product.trackItems.map((item) => ({
      id: item.id,
      trackNumber: item.trackNumber,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      productUrl: item.productUrl,
      imageUrl: item.imageUrl,
      photoReport: item.photoReport,
      photoReportUrl: item.photoReportUrl,
    })),
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/orders" className="breadcrumb-link">
              Заказы
            </Link>
            <span className="breadcrumb-sep">/</span>
            <span>Редактирование</span>
          </div>
          <h1 className="page-title">Редактирование заказа</h1>
        </div>
        <div className="header-actions">
          {product.isActive && (
            <form action={archiveOrder.bind(null, id)}>
              <button type="submit" className="btn-warning">
                Архивировать
              </button>
            </form>
          )}
          <DeleteOrderButton productId={id} deleteAction={deleteOrder} />
        </div>
      </div>

      <OrderForm
        action={update}
        product={productForForm}
        customers={dedupeCustomers(customers, { preferredId: product.customerId })}
      />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-sep { color: var(--color-border-strong); }

        .header-actions { display: flex; gap: 8px; align-items: center; }

        .btn-warning { padding: 9px 14px; background: transparent; border: 1px solid var(--color-warning); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-warning); cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; }
        .btn-warning:hover { background: var(--color-warning-bg); }
      `}</style>
    </div>
  );
}
