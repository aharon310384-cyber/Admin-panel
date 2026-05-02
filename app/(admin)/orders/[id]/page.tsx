import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCny, formatDateTime, formatUsd } from "@/lib/utils";
import { ORDER_STATUS_TONE } from "@/types";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { updateOrderStatus, deleteOrder } from "@/actions/orders";
import OrderActions from "./order-actions";
import ExchangeRateForm from "./exchange-rate-form";

export const metadata: Metadata = { title: "Заказ" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const order = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true,
      items: { include: { product: true } },
      statusHistory: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) notFound();

  const isAdmin = session?.user.role === "ADMIN";
  const totalUsd = Number(order.totalUsd || order.total || 0);
  const totalCny = Number(order.totalCny || 0);
  const exchangeRateCnyPerUsd = Number(order.exchangeRateCnyPerUsd || 7.1);
  const localDeliveryCny = Number(order.localDeliveryCny ?? 0);
  const discountCny = Number(order.discountCny ?? 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/orders" className="breadcrumb-link">Заказы</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{order.number}</span>
          </div>
          <h1 className="page-title">{order.number}</h1>
          <OrderStatusBadge status={order.status} className="page-status" />
        </div>

        <OrderActions
          orderId={order.id}
          currentStatus={order.status}
          isAdmin={isAdmin}
          updateStatus={updateOrderStatus}
          deleteOrderAction={deleteOrder}
        />
      </div>

      <div className="order-grid">
        <div className="card">
          <h2 className="card-title">Получатель</h2>
          <dl className="info-list">
            <div className="info-row">
              <dt>Имя</dt>
              <dd>
                <Link href={`/customers/${order.customer.id}`} className="link">
                  {order.recipientName || order.customer.name}
                </Link>
              </dd>
            </div>
            {order.customer.email && (
              <div className="info-row">
                <dt>Email</dt>
                <dd>{order.customer.email}</dd>
              </div>
            )}
            {order.customer.phone && (
              <div className="info-row">
                <dt>Телефон</dt>
                <dd>{order.customer.phone}</dd>
              </div>
            )}
            {order.recipientAddress && (
              <div className="info-row">
                <dt>Адрес</dt>
                <dd>{order.recipientAddress}</dd>
              </div>
            )}
            {order.customer.city && (
              <div className="info-row">
                <dt>Город</dt>
                <dd>{order.customer.city}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card">
          <h2 className="card-title">Детали заказа</h2>
          <dl className="info-list">
            <div className="info-row">
              <dt>Номер</dt>
              <dd className="mono">{order.number}</dd>
            </div>
            <div className="info-row">
              <dt>Создано</dt>
              <dd>{formatDateTime(order.createdAt)}</dd>
            </div>
            {order.saleDate && (
              <div className="info-row">
                <dt>Дата продажи</dt>
                <dd>{formatDateTime(order.saleDate)}</dd>
              </div>
            )}
            <div className="info-row">
              <dt>Посылка</dt>
              <dd className="mono">
                {order.parcelNumberLooksValid ? order.parcelNumber : "Номер не указан"}
              </dd>
            </div>
            {order.weightKg && (
              <div className="info-row">
                <dt>Вес</dt>
                <dd>{Number(order.weightKg).toFixed(2)} кг</dd>
              </div>
            )}
            {order.notes && (
              <div className="info-row">
                <dt>Заметки</dt>
                <dd>{order.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card card--full">
          <h2 className="card-title">Расчет и оплата</h2>
          <ExchangeRateForm
            orderId={order.id}
            totalUsd={totalUsd}
            totalCny={totalCny}
            exchangeRateCnyPerUsd={exchangeRateCnyPerUsd}
            localDeliveryCny={localDeliveryCny}
            discountCny={discountCny}
            isAdmin={isAdmin}
          />
          <dl className="money-details">
            <div className="info-row">
              <dt>Оплата</dt>
              <dd>{order.isPaid ? "Оплачен" : "Не оплачен"}</dd>
            </div>
            {order.localDeliveryCny && (
              <div className="info-row">
                <dt>Локальная доставка</dt>
                <dd>{formatCny(order.localDeliveryCny)}</dd>
              </div>
            )}
            {order.discountCny && (
              <div className="info-row">
                <dt>Скидка</dt>
                <dd>{formatCny(order.discountCny)}</dd>
              </div>
            )}
            {order.supplierCostCny && (
              <div className="info-row">
                <dt>Стоимость</dt>
                <dd>{formatCny(order.supplierCostCny)}</dd>
              </div>
            )}
            {order.profitCny && (
              <div className="info-row">
                <dt>Выручка</dt>
                <dd>{formatCny(order.profitCny)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card card--full">
          <h2 className="card-title">Состав заказа</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Услуга / позиция</th>
                  <th>Код</th>
                  <th style={{ textAlign: "right" }}>Тариф $</th>
                  <th style={{ textAlign: "right" }}>Кол-во</th>
                  <th style={{ textAlign: "right" }}>Итого $</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/products/${item.product.id}/edit`} className="link">
                        {item.name || item.product.name}
                      </Link>
                    </td>
                    <td className="mono text-muted">{item.product.sku}</td>
                    <td className="tabular" style={{ textAlign: "right" }}>
                      {formatUsd(item.price)}
                    </td>
                    <td className="tabular" style={{ textAlign: "right" }}>
                      {item.quantity}
                    </td>
                    <td className="tabular" style={{ textAlign: "right", fontWeight: 500 }}>
                      {formatUsd(Number(item.price) * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 600, paddingRight: 16 }}>
                    Итого:
                  </td>
                  <td className="tabular" style={{ textAlign: "right", fontWeight: 700, fontSize: 16 }}>
                    {formatUsd(totalUsd)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="card card--full">
          <h2 className="card-title">История статусов</h2>
          <div className="timeline">
            {order.statusHistory.map((entry, i) => (
              <div key={entry.id} className={`timeline-item ${i === order.statusHistory.length - 1 ? "timeline-item--last" : ""}`}>
                <div className={`timeline-dot timeline-dot--${ORDER_STATUS_TONE[entry.status]}`} />
                <div className="timeline-body">
                  <div className="timeline-top">
                    <OrderStatusBadge status={entry.status} />
                    <span className="timeline-date">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p className="timeline-meta">Изменил: {entry.user.name}</p>
                  {entry.note && <p className="timeline-note">{entry.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-link:hover { text-decoration: underline; }
        .breadcrumb-sep { color: var(--color-border-strong); }

        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-status { margin-top: 8px; }

        .order-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .card {
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 20px;
          box-shadow: var(--shadow-card);
        }

        .card--full { grid-column: 1 / -1; }
        .card-title { font-size: 14px; font-weight: 600; margin: 0 0 16px; color: var(--color-text); }

        .info-list { display: flex; flex-direction: column; gap: 10px; }
        .money-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; margin: 16px 0 0; }
        .info-row { display: flex; gap: 12px; font-size: 13px; }
        .info-row dt { width: 100px; flex-shrink: 0; color: var(--color-muted); }
        .info-row dd { flex: 1; color: var(--color-text); margin: 0; }

        .link { color: var(--color-accent); text-decoration: none; }
        .link:hover { text-decoration: underline; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }

        .table-wrap { overflow-x: auto; margin: 0 -20px; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th {
          text-align: left; padding: 8px 20px;
          font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
          color: var(--color-muted); border-bottom: 1px solid var(--color-border);
        }
        .table td { padding: 12px 20px; border-bottom: 1px solid var(--color-border); color: var(--color-text); }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tfoot td { padding: 12px 20px; border-top: 2px solid var(--color-border); }

        .timeline { display: flex; flex-direction: column; gap: 0; }
        .timeline-item {
          display: flex; gap: 16px; padding-bottom: 20px;
          position: relative;
        }
        .timeline-item:not(.timeline-item--last)::before {
          content: '';
          position: absolute; left: 7px; top: 20px; bottom: 0;
          width: 2px; background: var(--color-border);
        }
        .timeline-dot {
          width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
          margin-top: 3px; border: 2px solid var(--color-bg);
          box-shadow: 0 0 0 2px currentColor;
        }
        .timeline-dot--new { color: var(--color-status-new); background: var(--color-status-new); }
        .timeline-dot--processing { color: var(--color-status-processing); background: var(--color-status-processing); }
        .timeline-dot--shipped { color: var(--color-status-shipped); background: var(--color-status-shipped); }
        .timeline-dot--completed { color: var(--color-status-completed); background: var(--color-status-completed); }
        .timeline-dot--paid { color: var(--color-status-completed); background: var(--color-status-completed); }
        .timeline-dot--canceled { color: var(--color-status-canceled); background: var(--color-status-canceled); }
        .timeline-dot--returned-paid { color: var(--color-status-completed); background: var(--color-status-completed); }
        .timeline-dot--returned-unpaid { color: var(--color-status-processing); background: var(--color-status-processing); }
        .timeline-body { flex: 1; }
        .timeline-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .timeline-date { font-size: 12px; color: var(--color-muted); }
        .timeline-meta { font-size: 12px; color: var(--color-muted); margin: 4px 0 0; }
        .timeline-note { font-size: 13px; color: var(--color-text); margin: 6px 0 0; font-style: italic; }

        @media (max-width: 768px) {
          .order-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
