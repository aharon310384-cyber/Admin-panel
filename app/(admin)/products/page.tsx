/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/utils";
import { Plus, Search, PackageCheck } from "lucide-react";
import { auth } from "@/auth";
import { ProductStatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Услуги" };

const LIMIT = 20;

type SearchParams = {
  page?: string;
  search?: string;
  active?: string;
  inStock?: string;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const search = params.search?.trim() ?? "";
  const activeFilter = params.active;
  const inStockFilter = params.inStock;

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { sku: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(activeFilter !== undefined ? { isActive: activeFilter === "true" } : {}),
    ...(inStockFilter === "true" ? { stock: { gt: 0 } } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Услуги</h1>
          <p className="page-subtitle">{total} услуг всего</p>
        </div>
        {isAdmin && (
          <Link href="/products/new" className="btn-primary">
            <Plus size={16} />
            Добавить услугу
          </Link>
        )}
      </div>

      <div className="filters">
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <form>
            <input
              type="search"
              name="search"
              placeholder="Поиск по услуге, коду или slug..."
              defaultValue={search}
              className="search-input"
            />
          </form>
        </div>
        <div className="filter-chips">
          <Link
            href={`/products?${search ? `search=${search}&` : ""}active=true`}
            className={`filter-chip ${activeFilter === "true" ? "filter-chip--active" : ""}`}
          >
            Активные
          </Link>
          <Link
            href={`/products?${search ? `search=${search}&` : ""}active=false`}
            className={`filter-chip ${activeFilter === "false" ? "filter-chip--active" : ""}`}
          >
            Архив
          </Link>
          <Link
            href={`/products?${search ? `search=${search}&` : ""}inStock=true`}
            className={`filter-chip ${inStockFilter === "true" ? "filter-chip--active" : ""}`}
          >
            Доступные
          </Link>
          {(activeFilter || inStockFilter) && (
            <Link href="/products" className="filter-chip-clear">
              Сбросить
            </Link>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Услуга</th>
                <th>Код</th>
                <th>Тариф $</th>
                <th>Лимит</th>
                <th>Статус</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="product-cell">
                      <div className="product-img">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} width={36} height={36} style={{ objectFit: "cover", borderRadius: 6 }} />
                        ) : (
                          <PackageCheck size={16} color="var(--color-muted)" />
                        )}
                      </div>
                      <span className="product-name">{product.name}</span>
                    </div>
                  </td>
                  <td className="mono text-muted">{product.sku}</td>
                  <td className="tabular">{formatUsd(product.price)}</td>
                  <td className={`tabular ${product.stock === 0 ? "text-danger" : ""}`}>
                    {product.stock} ед.
                  </td>
                  <td>
                    <ProductStatusBadge active={product.isActive} />
                  </td>
                  {isAdmin && (
                    <td>
                      <Link href={`/products/${product.id}/edit`} className="btn-ghost btn-sm">
                        Редактировать →
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="table-empty">
                    Услуг не найдено
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
                href={`/products?page=${p}${search ? `&search=${search}` : ""}`}
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
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }

        .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; white-space: nowrap; }
        .btn-primary:hover { background: var(--color-accent-hover); }

        .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
        .search-wrap { position: relative; flex: 1; min-width: 220px; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }
        .search-input { width: 100%; padding: 9px 12px 9px 36px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .search-input:focus { border-color: var(--color-accent); }

        .filter-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .filter-chip { padding: 6px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: 12px; font-weight: 500; color: var(--color-text-secondary); text-decoration: none; transition: all 0.15s; }
        .filter-chip:hover { border-color: var(--color-accent); color: var(--color-accent); }
        .filter-chip--active { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-fg); }
        .filter-chip-clear { padding: 6px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: 12px; color: var(--color-muted); text-decoration: none; transition: all 0.15s; }
        .filter-chip-clear:hover { color: var(--color-danger); border-color: var(--color-danger); }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); }
        .table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text); }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }

        .product-cell { display: flex; align-items: center; gap: 10px; }
        .product-img { width: 36px; height: 36px; background: var(--color-muted-bg); border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
        .product-name { font-weight: 500; }

        .mono { font-family: var(--font-mono); font-size: 12px; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }
        .text-danger { color: var(--color-danger); font-weight: 500; }

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
