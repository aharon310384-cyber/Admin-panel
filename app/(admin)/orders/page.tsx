import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCny, formatDateTime, formatUsd } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import type { OrderStatus } from "@prisma/client";
import OrdersFilters from "./orders-filters";

export const metadata: Metadata = { title: "Заказы" };

const LIMIT = 20;

type SearchParams = {
  page?: string;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const search = params.search?.trim() ?? "";
  const statusFilter = params.status as OrderStatus | undefined;
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : undefined;
  const dateTo = params.dateTo
    ? new Date(new Date(params.dateTo).setHours(23, 59, 59, 999))
    : undefined;
  const amountMin = params.amountMin ? parseFloat(params.amountMin) : undefined;
  const amountMax = params.amountMax ? parseFloat(params.amountMax) : undefined;

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" as const } },
            { customer: { name: { contains: search, mode: "insensitive" as const } } },
            { recipientName: { contains: search, mode: "insensitive" as const } },
            { parcelNumber: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
      : {}),
    ...(amountMin !== undefined || amountMax !== undefined
      ? { total: { ...(amountMin !== undefined ? { gte: amountMin } : {}), ...(amountMax !== undefined ? { lte: amountMax } : {}) } }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Заказы</h1>
          <p className="page-subtitle">{total} заказов всего</p>
        </div>
        <div className="header-actions">
          <Link href="/orders/new" className="btn-primary">
            + Новый заказ
          </Link>
          <Link href="/api/export/orders" className="btn-secondary">
            Экспорт CSV
          </Link>
        </div>
      </div>

      <OrdersFilters />

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Получатель</th>
                <th>Статус</th>
                <th>Расчет $</th>
                <th>К оплате ¥</th>
                <th>Посылка</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/orders/${order.id}`} className="link">
                      {order.number}
                    </Link>
                  </td>
                  <td>{order.recipientName || order.customer.name}</td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="tabular">{formatUsd(order.totalUsd || order.total)}</td>
                  <td className="tabular">{formatCny(order.totalCny)}</td>
                  <td className="mono text-muted">
                    {order.parcelNumberLooksValid ? order.parcelNumber : "—"}
                  </td>
                  <td className="text-muted">{formatDateTime(order.createdAt)}</td>
                  <td>
                    <Link
                      href={`/orders/${order.id}`}
                      className="btn-ghost btn-sm"
                    >
                      Подробнее →
                    </Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty">
                    Заказов не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/orders?page=${p}${search ? `&search=${search}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`}
                className={`pagination-btn ${p === page ? "pagination-btn--active" : ""}`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .btn-primary:hover { background: var(--color-accent-hover); }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }

        .btn-secondary:hover {
          background: var(--color-muted-bg);
          border-color: var(--color-border-strong);
        }

        .card {
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-card);
          overflow: hidden;
        }

        .table-wrap { overflow-x: auto; }

        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }

        .table th {
          text-align: left;
          padding: 10px 16px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-muted);
          border-bottom: 1px solid var(--color-border);
          white-space: nowrap;
        }

        .table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text);
        }

        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }

        .link { color: var(--color-accent); text-decoration: none; font-weight: 500; }
        .link:hover { text-decoration: underline; }

        .tabular { font-variant-numeric: tabular-nums; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .text-muted { color: var(--color-muted); }

        .btn-ghost {
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 500;
          color: var(--color-accent);
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }

        .btn-ghost:hover { background: oklch(52% 0.14 42 / 0.08); }
        .btn-sm { padding: 4px 8px; font-size: 12px; }

        .table-empty {
          text-align: center;
          padding: 40px 16px !important;
          color: var(--color-muted);
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 16px;
          border-top: 1px solid var(--color-border);
          flex-wrap: wrap;
        }

        .pagination-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          color: var(--color-text-secondary);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }

        .pagination-btn:hover { background: var(--color-muted-bg); color: var(--color-text); }

        .pagination-btn--active {
          background: var(--color-accent);
          color: var(--color-accent-fg);
          font-weight: 600;
        }

        .pagination-btn--active:hover { background: var(--color-accent-hover); }
      `}</style>
    </div>
  );
}
