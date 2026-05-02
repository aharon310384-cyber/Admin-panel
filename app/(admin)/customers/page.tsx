import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCny, formatDateTime } from "@/lib/utils";
import { Search } from "lucide-react";

export const metadata: Metadata = { title: "Получатели" };

const LIMIT = 20;

type SearchParams = {
  page?: string;
  search?: string;
  sort?: string;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "createdAt_desc";

  const [sortField, sortDir] = sort.split("_") as [string, "asc" | "desc"];

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
            { country: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        _count: { select: { orders: { where: { deletedAt: null } } } },
        orders: {
          where: { deletedAt: null, status: { not: "CANCELED" } },
          select: { totalCny: true },
        },
      },
      orderBy:
        sortField === "total"
          ? undefined
          : { [sortField]: sortDir },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.customer.count({ where }),
  ]);

  const customersWithTotal = customers.map((c) => ({
    ...c,
    totalSpent: c.orders.reduce((sum, o) => sum + Number(o.totalCny), 0),
  }));

  if (sortField === "total") {
    customersWithTotal.sort((a, b) =>
      sortDir === "asc"
        ? a.totalSpent - b.totalSpent
        : b.totalSpent - a.totalSpent
    );
  }

  const totalPages = Math.ceil(total / LIMIT);

  const sortLink = (field: string) => {
    const dir =
      sortField === field && sortDir === "desc" ? "asc" : "desc";
    return `/customers?sort=${field}_${dir}${search ? `&search=${search}` : ""}`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Получатели</h1>
          <p className="page-subtitle">{total} получателей всего</p>
        </div>
      </div>

      <div className="search-wrap">
        <Search size={15} className="search-icon" />
        <form>
          <input
            type="search"
            name="search"
            placeholder="Поиск по имени, коду, email, стране или городу..."
            defaultValue={search}
            className="search-input"
          />
        </form>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Получатель</th>
                <th>Страна / город</th>
                <th>
                  <Link href={sortLink("createdAt")} className="sort-link">
                    Регистрация{" "}
                    {sortField === "createdAt" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </Link>
                </th>
                <th>Заказов</th>
                <th>
                  <Link href={sortLink("total")} className="sort-link">
                    Оплаты ¥{" "}
                    {sortField === "total" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </Link>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customersWithTotal.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div className="customer-cell">
                      <div className="customer-avatar">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="customer-name">{customer.name}</p>
                        <p className="customer-email">{customer.email ?? customer.code ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted">
                    {[customer.country, customer.city].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="text-muted">{formatDateTime(customer.createdAt)}</td>
                  <td className="tabular">{customer._count.orders}</td>
                  <td className="tabular">{formatCny(customer.totalSpent)}</td>
                  <td>
                    <Link
                      href={`/customers/${customer.id}`}
                      className="btn-ghost btn-sm"
                    >
                      Подробнее →
                    </Link>
                  </td>
                </tr>
              ))}
              {customersWithTotal.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Получателей не найдено
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
                href={`/customers?page=${p}${search ? `&search=${search}` : ""}&sort=${sort}`}
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
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }

        .search-wrap { position: relative; max-width: 480px; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }
        .search-input { width: 100%; padding: 9px 12px 9px 36px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .search-input:focus { border-color: var(--color-accent); }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text); }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }

        .sort-link { color: inherit; text-decoration: none; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
        .sort-link:hover { color: var(--color-accent); }

        .customer-cell { display: flex; align-items: center; gap: 10px; }
        .customer-avatar { width: 32px; height: 32px; background: oklch(52% 0.14 42 / 0.12); color: var(--color-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0; }
        .customer-name { font-size: 13.5px; font-weight: 500; margin: 0; color: var(--color-text); }
        .customer-email { font-size: 12px; color: var(--color-muted); margin: 2px 0 0; }

        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }

        .btn-ghost { display: inline-flex; align-items: center; padding: 5px 10px; background: transparent; border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; color: var(--color-accent); text-decoration: none; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .btn-ghost:hover { background: oklch(52% 0.14 42 / 0.08); }
        .btn-sm { padding: 4px 8px; }

        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }

        .pagination { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 16px; border-top: 1px solid var(--color-border); flex-wrap: wrap; }
        .pagination-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-secondary); text-decoration: none; transition: background 0.15s, color 0.15s; }
        .pagination-btn:hover { background: var(--color-muted-bg); color: var(--color-text); }
        .pagination-btn--active { background: var(--color-accent); color: var(--color-accent-fg); font-weight: 600; }
      `}</style>
    </div>
  );
}
