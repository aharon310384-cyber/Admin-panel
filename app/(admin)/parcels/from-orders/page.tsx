import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ORDER_NOT_IN_ACTIVE_PARCEL } from "@/lib/order-filters";
import { getFinanceSettings } from "@/lib/finance";
import FromOrdersForm, { type FromOrdersOrder } from "./from-orders-form";

export const metadata: Metadata = { title: "Оформление посылки" };

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/orders" className="breadcrumb-link">
              Заказы
            </Link>
            <span className="breadcrumb-sep">/</span>
            <span>Оформление посылки</span>
          </div>
          <h1 className="page-title">Оформление посылки</h1>
        </div>
      </div>

      <div className="error-card">
        <AlertTriangle size={18} className="error-icon" />
        <div className="error-body">
          <p className="error-title">Не получилось продолжить</p>
          <p className="error-text">{message}</p>
          <Link href="/orders" className="btn-primary">
            Вернуться к заказам
          </Link>
        </div>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-sep { color: var(--color-border-strong); }

        .error-card { display: flex; gap: 12px; padding: 20px; background: var(--color-warning-bg); border: 1px solid color-mix(in srgb, var(--color-warning) 28%, transparent); border-radius: var(--radius-md); }
        .error-icon { color: var(--color-warning); flex-shrink: 0; margin-top: 2px; }
        .error-body { display: flex; flex-direction: column; gap: 8px; }
        .error-title { font-size: 14px; font-weight: 600; color: var(--color-text); margin: 0; }
        .error-text { font-size: 13px; color: var(--color-muted); margin: 0; line-height: 1.5; }
        .btn-primary { display: inline-flex; width: fit-content; align-items: center; padding: 9px 16px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; transition: background 0.15s; margin-top: 6px; }
        .btn-primary:hover { background: var(--color-accent-hover); }
      `}</style>
    </div>
  );
}

export default async function FromOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ orderIds?: string }>;
}) {
  const { orderIds } = await searchParams;
  const ids = (orderIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    redirect("/orders");
  }

  const orders = await prisma.order.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      ...ORDER_NOT_IN_ACTIVE_PARCEL,
    },
    select: {
      id: true,
      sku: true,
      name: true,
      price: true,
      stock: true,
      deliveryType: true,
      customer: {
        select: {
          id: true,
          name: true,
          code: true,
          clientCode: true,
          countryCode: true,
        },
      },
    },
  });

  if (orders.length === 0) {
    return (
      <ErrorPage message="Выбранные заказы недоступны для оформления — возможно, они уже находятся в другой посылке или удалены." />
    );
  }

  if (orders.length !== ids.length) {
    return (
      <ErrorPage message="Часть выбранных заказов уже оформлена в другую посылку. Обновите страницу заказов и попробуйте снова." />
    );
  }

  const customerIds = new Set(orders.map((o) => o.customer?.id ?? null));
  if (customerIds.size > 1 || customerIds.has(null)) {
    return (
      <ErrorPage message="Выбраны заказы разных получателей. В одной посылке могут быть только заказы одного получателя." />
    );
  }

  const deliveryTypes = new Set(orders.map((o) => o.deliveryType ?? ""));
  if (deliveryTypes.size > 1 || deliveryTypes.has("")) {
    return (
      <ErrorPage message="Выбраны заказы с разным типом доставки или без указанного типа. Проверьте, что у всех выбранных заказов одинаковый тип доставки." />
    );
  }

  const customer = orders[0].customer!;
  const deliveryType = orders[0].deliveryType ?? "";

  const ordersForForm: FromOrdersOrder[] = orders.map((o) => ({
    id: o.id,
    sku: o.sku,
    name: o.name,
    price: Number(o.price),
    stock: o.stock,
  }));

  const finance = await getFinanceSettings();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/orders" className="breadcrumb-link">
              Заказы
            </Link>
            <span className="breadcrumb-sep">/</span>
            <span>Оформление посылки</span>
          </div>
          <h1 className="page-title">Оформление посылки</h1>
        </div>
      </div>

      <FromOrdersForm
        orders={ordersForForm}
        customer={{
          id: customer.id,
          name: customer.name,
          code: customer.clientCode ?? customer.code ?? null,
          countryCode: customer.countryCode ?? null,
        }}
        deliveryType={deliveryType}
        finance={{
          exchangeRateCnyPerUsd: finance.exchangeRateCnyPerUsd,
        }}
      />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-sep { color: var(--color-border-strong); }
      `}</style>
    </div>
  );
}
