import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCny, formatDateTime, formatUsd } from "@/lib/utils";
import { ParcelStatusBadge } from "@/components/ui/status-badge";
import type { ParcelStatus } from "@prisma/client";
import ParcelsFilters from "./parcels-filters";
import SortableHeader from "@/components/ui/sortable-header";
import { Pagination } from "@/components/ui/pagination";
import { parsePageParam } from "@/lib/list-params";

export const metadata: Metadata = { title: "Посылки" };

const LIMIT = 20;

type SearchParams = {
  page?: string;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  sort?: string;
};

type SortDirection = "asc" | "desc";
type OrderSortField =
  | "number"
  | "recipient"
  | "status"
  | "totalUsd"
  | "totalCny"
  | "parcelNumber"
  | "createdAt";

function normalizeSort(sort: string | undefined): [OrderSortField, SortDirection] {
  const [field, direction] = (sort ?? "createdAt_desc").split("_");
  const fields = new Set<OrderSortField>([
    "number",
    "recipient",
    "status",
    "totalUsd",
    "totalCny",
    "parcelNumber",
    "createdAt",
  ]);

  return [
    fields.has(field as OrderSortField) ? (field as OrderSortField) : "createdAt",
    direction === "asc" ? "asc" : "desc",
  ];
}

function orderOrderBy(
  field: OrderSortField,
  direction: SortDirection
): Prisma.ParcelOrderByWithRelationInput | Prisma.ParcelOrderByWithRelationInput[] {
  if (field === "recipient") {
    return [{ recipientName: direction }, { customer: { name: direction } }, { createdAt: "desc" }];
  }

  return [{ [field]: direction }, { createdAt: "desc" }];
}

function ordersHref(
  values: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: string;
    amountMax?: string;
    sort?: string;
    page?: string;
  },
  overrides: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: string;
    amountMax?: string;
    sort?: string;
    page?: string | null;
  }
): string {
  const query = new URLSearchParams();
  const next = { ...values, ...overrides };

  for (const [key, value] of Object.entries(next)) {
    if (value) {
      query.set(key, value);
    }
  }

  const params = query.toString();
  return params ? `/parcels?${params}` : "/parcels";
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const search = params.search?.trim() ?? "";
  const statusFilter = params.status as ParcelStatus | undefined;
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : undefined;
  const dateTo = params.dateTo
    ? new Date(new Date(params.dateTo).setHours(23, 59, 59, 999))
    : undefined;
  const amountMin = params.amountMin ? parseFloat(params.amountMin) : undefined;
  const amountMax = params.amountMax ? parseFloat(params.amountMax) : undefined;
  const sort = params.sort ?? "createdAt_desc";
  const [sortField, sortDir] = normalizeSort(sort);

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { number: { contains: search} },
            { customer: { name: { contains: search} } },
            { recipientName: { contains: search} },
            { parcelNumber: { contains: search} },
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
    prisma.parcel.findMany({
      where,
      include: { customer: true },
      orderBy: orderOrderBy(sortField, sortDir),
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.parcel.count({ where }),
  ]);

  const totalPages = Math.ceil(total / LIMIT);
  const filterValues = {
    search,
    status: statusFilter,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    amountMin: params.amountMin,
    amountMax: params.amountMax,
    sort,
  };
  const sortHref = (
    field: OrderSortField,
    defaultDirection: SortDirection = "asc"
  ) => {
    const nextDirection =
      sortField === field ? (sortDir === "asc" ? "desc" : "asc") : defaultDirection;
    return ordersHref(filterValues, { sort: `${field}_${nextDirection}`, page: null });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Посылки</h1>
          <p className="page-subtitle">{total} посылок всего</p>
        </div>
        <div className="header-actions">
          <Link href="/parcels/new" className="btn-primary">
            + Новая посылка
          </Link>
          <Link href="/api/export/orders" className="btn-secondary">
            Экспорт CSV
          </Link>
        </div>
      </div>

      <ParcelsFilters />

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <SortableHeader
                    label="Дата"
                    href={sortHref("createdAt", "desc")}
                    active={sortField === "createdAt"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Номер"
                    href={sortHref("number")}
                    active={sortField === "number"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Получатель"
                    href={sortHref("recipient")}
                    active={sortField === "recipient"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Статус"
                    href={sortHref("status")}
                    active={sortField === "status"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Расчет $"
                    href={sortHref("totalUsd", "desc")}
                    active={sortField === "totalUsd"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="К оплате ¥"
                    href={sortHref("totalCny", "desc")}
                    active={sortField === "totalCny"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Посылка"
                    href={sortHref("parcelNumber")}
                    active={sortField === "parcelNumber"}
                    direction={sortDir}
                  />
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="text-muted">{formatDateTime(order.createdAt)}</td>
                  <td>
                    <Link href={`/parcels/${order.id}`} className="link">
                      {order.number}
                    </Link>
                  </td>
                  <td>{order.recipientName || order.customer.name}</td>
                  <td>
                    <ParcelStatusBadge status={order.status} />
                  </td>
                  <td className="tabular">{formatUsd(order.totalUsd || order.total)}</td>
                  <td className="tabular">{formatCny(order.totalCny)}</td>
                  <td className="mono text-muted">
                    {order.parcelNumberLooksValid ? order.parcelNumber : "—"}
                  </td>
                  <td>
                    <Link
                      href={`/parcels/${order.id}`}
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
                    Посылок не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          hrefForPage={(p) => ordersHref(filterValues, { page: String(p) })}
        />
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

      `}</style>
    </div>
  );
}
