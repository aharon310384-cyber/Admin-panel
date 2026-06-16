import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Plus, Search } from "lucide-react";
import { auth } from "@/auth";
import { Pagination } from "@/components/ui/pagination";
import { parsePageParam } from "@/lib/list-params";
import { ORDER_NOT_IN_ACTIVE_PARCEL } from "@/lib/order-filters";
import OrdersTable, { type OrderRow } from "./orders-table";

export const metadata: Metadata = { title: "Заказы" };

const LIMIT = 20;

type SearchParams = {
  page?: string;
  search?: string;
  active?: string;
  inStock?: string;
  inParcel?: string;
  sort?: string;
};

type SortDirection = "asc" | "desc";
type ProductSortField = "name" | "sku" | "price" | "stock" | "isActive" | "createdAt";

function normalizeSort(sort: string | undefined): [ProductSortField, SortDirection] {
  const [field, direction] = (sort ?? "createdAt_desc").split("_");
  const fields = new Set<ProductSortField>([
    "name",
    "sku",
    "price",
    "stock",
    "isActive",
    "createdAt",
  ]);

  return [
    fields.has(field as ProductSortField) ? (field as ProductSortField) : "createdAt",
    direction === "asc" ? "asc" : "desc",
  ];
}

function productOrderBy(
  field: ProductSortField,
  direction: SortDirection
): Prisma.OrderOrderByWithRelationInput | Prisma.OrderOrderByWithRelationInput[] {
  return [{ [field]: direction }, { name: "asc" }];
}

function productsHref(
  values: {
    search?: string;
    active?: string;
    inStock?: string;
    inParcel?: string;
    sort?: string;
    page?: string;
  },
  overrides: {
    search?: string;
    active?: string;
    inStock?: string;
    inParcel?: string;
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
  return params ? `/orders?${params}` : "/orders";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const page = parsePageParam(params.page);
  const search = params.search?.trim() ?? "";
  const activeFilter = params.active;
  const inStockFilter = params.inStock;
  const inParcelFilter = params.inParcel;
  const sort = params.sort ?? "createdAt_desc";
  const [sortField, sortDir] = normalizeSort(sort);

  const parcelFilter: Prisma.OrderWhereInput =
    inParcelFilter === "true"
      ? {
          parcelItems: {
            some: { parcel: { deletedAt: null, status: { not: "CANCELED" } } },
          },
        }
      : inParcelFilter === "all"
        ? {}
        : ORDER_NOT_IN_ACTIVE_PARCEL;

  const where = {
    deletedAt: null,
    ...parcelFilter,
    ...(search
      ? {
          OR: [
            { name: { contains: search} },
            { comments: { contains: search} },
            { sku: { contains: search} },
            { slug: { contains: search} },
            { trackItems: { some: { trackNumber: { contains: search} } } },
            { trackItems: { some: { name: { contains: search} } } },
          ],
        }
      : {}),
    ...(activeFilter !== undefined ? { isActive: activeFilter === "true" } : {}),
    ...(inStockFilter === "true" ? { stock: { gt: 0 } } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: productOrderBy(sortField, sortDir),
      skip: (page - 1) * LIMIT,
      take: LIMIT,
      select: {
        id: true,
        sku: true,
        name: true,
        comments: true,
        price: true,
        stock: true,
        isActive: true,
        imageUrl: true,
        deliveryType: true,
        customer: { select: { id: true, name: true, code: true } },
        parcelItems: {
          where: { parcel: { deletedAt: null, status: { not: "CANCELED" } } },
          select: {
            parcel: { select: { id: true, number: true, status: true } },
          },
          orderBy: { parcel: { createdAt: "desc" } },
          take: 1,
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const ordersForTable: OrderRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    comments: p.comments,
    price: Number(p.price),
    stock: p.stock,
    isActive: p.isActive,
    imageUrl: p.imageUrl,
    deliveryType: p.deliveryType,
    customer: p.customer,
    parcel: p.parcelItems[0]?.parcel ?? null,
  }));

  const totalPages = Math.ceil(total / LIMIT);
  const filterValues = {
    search,
    active: activeFilter,
    inStock: inStockFilter,
    inParcel: inParcelFilter,
    sort,
  };
  const sortHref = (
    field: ProductSortField,
    defaultDirection: SortDirection = "asc"
  ) => {
    const nextDirection =
      sortField === field ? (sortDir === "asc" ? "desc" : "asc") : defaultDirection;
    return productsHref(filterValues, { sort: `${field}_${nextDirection}`, page: null });
  };

  const sortHrefs = {
    name: sortHref("name"),
    sku: sortHref("sku"),
    price: sortHref("price", "desc"),
    stock: sortHref("stock", "desc"),
    isActive: sortHref("isActive", "desc"),
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Заказы</h1>
          <p className="page-subtitle">
            {inParcelFilter === "true"
              ? `${total} заказов оформлено в посылки`
              : inParcelFilter === "all"
                ? `${total} заказов всего`
                : `${total} заказов в обработке`}
            {" · оформленные на отправку переходят в "}
            <Link href="/parcels" className="page-subtitle-link">посылки</Link>
          </p>
        </div>
        <div className="header-actions">
          <Link href="/parcels/new" className="btn-secondary">
            + Новая посылка
          </Link>
          {isAdmin && (
            <Link href="/orders/new" className="btn-primary">
              <Plus size={16} />
              Добавить заказ
            </Link>
          )}
        </div>
      </div>

      <div className="filters">
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <form>
            <input type="hidden" name="sort" value={`${sortField}_${sortDir}`} />
            {activeFilter && <input type="hidden" name="active" value={activeFilter} />}
            {inStockFilter && <input type="hidden" name="inStock" value={inStockFilter} />}
            {inParcelFilter && <input type="hidden" name="inParcel" value={inParcelFilter} />}
            <input
              type="search"
              name="search"
              placeholder="Поиск по трек номеру, наименованию, комментарию или коду..."
              defaultValue={search}
              className="search-input"
            />
          </form>
        </div>
        <div className="filter-chips">
          <Link
            href={productsHref(filterValues, { inParcel: undefined, page: null })}
            className={`filter-chip ${!inParcelFilter ? "filter-chip--active" : ""}`}
          >
            В работе
          </Link>
          <Link
            href={productsHref(filterValues, { inParcel: "true", page: null })}
            className={`filter-chip ${inParcelFilter === "true" ? "filter-chip--active" : ""}`}
          >
            В посылках
          </Link>
          <Link
            href={productsHref(filterValues, { inParcel: "all", page: null })}
            className={`filter-chip ${inParcelFilter === "all" ? "filter-chip--active" : ""}`}
          >
            Все
          </Link>
        </div>
        <div className="filter-chips">
          <Link
            href={productsHref(filterValues, { active: "true", inStock: undefined, page: null })}
            className={`filter-chip ${activeFilter === "true" ? "filter-chip--active" : ""}`}
          >
            Активные
          </Link>
          <Link
            href={productsHref(filterValues, { active: "false", inStock: undefined, page: null })}
            className={`filter-chip ${activeFilter === "false" ? "filter-chip--active" : ""}`}
          >
            Архив
          </Link>
          <Link
            href={productsHref(filterValues, { active: undefined, inStock: "true", page: null })}
            className={`filter-chip ${inStockFilter === "true" ? "filter-chip--active" : ""}`}
          >
            Доступные
          </Link>
          {(activeFilter || inStockFilter) && (
            <Link href={productsHref(filterValues, { active: undefined, inStock: undefined, page: null })} className="filter-chip-clear">
              Сбросить
            </Link>
          )}
        </div>
      </div>

      <OrdersTable
        orders={ordersForTable}
        sortHrefs={sortHrefs}
        sortField={sortField}
        sortDir={sortDir}
        isAdmin={isAdmin}
        showParcelColumn={inParcelFilter === "true" || inParcelFilter === "all"}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        hrefForPage={(p) => productsHref(filterValues, { page: String(p) })}
      />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }
        .page-subtitle-link { color: var(--color-accent); text-decoration: none; }
        .page-subtitle-link:hover { text-decoration: underline; }

        .header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; white-space: nowrap; }
        .btn-primary:hover { background: var(--color-accent-hover); }
        .btn-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-text); text-decoration: none; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; white-space: nowrap; }
        .btn-secondary:hover { background: var(--color-muted-bg); }

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
        .product-name { font-weight: 500; white-space: pre-line; }
        .comments-cell { max-width: 260px; color: var(--color-text-secondary); white-space: pre-line; line-height: 1.35; }

        .mono { font-family: var(--font-mono); font-size: 12px; }
        .order-number { color: var(--color-text); font-weight: 500; letter-spacing: 0.02em; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }
        .text-danger { color: var(--color-danger); font-weight: 500; }

        .btn-ghost { display: inline-flex; align-items: center; padding: 5px 10px; background: transparent; border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; color: var(--color-accent); text-decoration: none; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .btn-ghost:hover { background: oklch(52% 0.14 42 / 0.08); }
        .btn-sm { padding: 4px 8px; }

        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }

      `}</style>
    </div>
  );
}
