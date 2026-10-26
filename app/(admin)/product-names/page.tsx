import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus, Search } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SortableHeader from "@/components/ui/sortable-header";
import { Pagination } from "@/components/ui/pagination";
import TableRowLink from "@/components/ui/table-row-link";
import { parsePageParam } from "@/lib/list-params";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Наименования товаров" };

const LIMIT = 50;

type SearchParams = {
  page?: string;
  search?: string;
  sort?: string;
};

type SortDirection = "asc" | "desc";
type ProductNameSortField = "code" | "nameRu" | "nameEn" | "nameCn" | "category" | "hsCode" | "createdAt";

function dash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function normalizeSort(sort: string | undefined): [ProductNameSortField, SortDirection] {
  const [field, direction] = (sort ?? "code_asc").split("_");
  const fields = new Set<ProductNameSortField>([
    "code",
    "nameRu",
    "nameEn",
    "nameCn",
    "category",
    "hsCode",
    "createdAt",
  ]);

  return [
    fields.has(field as ProductNameSortField) ? (field as ProductNameSortField) : "code",
    direction === "desc" ? "desc" : "asc",
  ];
}

function productNamesHref(
  values: { search?: string; sort?: string; page?: string },
  overrides: { search?: string; sort?: string; page?: string | null }
): string {
  const query = new URLSearchParams();
  const next = { ...values, ...overrides };

  for (const [key, value] of Object.entries(next)) {
    if (value) {
      query.set(key, value);
    }
  }

  const params = query.toString();
  return params ? `/product-names?${params}` : "/product-names";
}

function productNameOrderBy(
  field: ProductNameSortField,
  direction: SortDirection
): Prisma.ProductNameOrderByWithRelationInput[] {
  return [{ [field]: direction }, { code: "asc" }];
}

export default async function ProductNamesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const page = parsePageParam(params.page);
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "code_asc";
  const [sortField, sortDir] = normalizeSort(sort);

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { nameRu: { contains: search, mode: "insensitive" } },
            { nameEn: { contains: search, mode: "insensitive" } },
            { nameCn: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { hsCode: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  } satisfies Prisma.ProductNameWhereInput;

  const [productNames, total] = await Promise.all([
    prisma.productName.findMany({
      where,
      orderBy: productNameOrderBy(sortField, sortDir),
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.productName.count({ where }),
  ]);

  const totalPages = Math.ceil(total / LIMIT);
  const sortHref = (field: ProductNameSortField, defaultDirection: SortDirection = "asc") => {
    const nextDirection =
      sortField === field ? (sortDir === "asc" ? "desc" : "asc") : defaultDirection;
    return productNamesHref({ search, sort }, { sort: `${field}_${nextDirection}`, page: null });
  };

  return (
    <>
      <Form
        formKey="product-names"
        title="Наименования товаров"
        commands={
          isAdmin && (
            <Link href="/product-names/new" className="cmd cmd--primary" data-command="create">
              <Plus size={15} />
              Создать
            </Link>
          )
        }
        header={
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <form>
              <input type="hidden" name="sort" value={`${sortField}_${sortDir}`} />
              <input
                type="search"
                name="search"
                placeholder="Поиск по коду, наименованию, секции или HS-коду..."
                defaultValue={search}
                className="search-input"
              />
            </form>
          </div>
        }
        footer={<>{total} записей в регистре</>}
      >
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <SortableHeader
                      label="Код"
                      href={sortHref("code")}
                      active={sortField === "code"}
                      direction={sortDir}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      label="Наименование RU"
                      href={sortHref("nameRu")}
                      active={sortField === "nameRu"}
                      direction={sortDir}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      label="Наименование EN"
                      href={sortHref("nameEn")}
                      active={sortField === "nameEn"}
                      direction={sortDir}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      label="Наименование CN"
                      href={sortHref("nameCn")}
                      active={sortField === "nameCn"}
                      direction={sortDir}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      label="Секция"
                      href={sortHref("category")}
                      active={sortField === "category"}
                      direction={sortDir}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      label="HS-код"
                      href={sortHref("hsCode")}
                      active={sortField === "hsCode"}
                      direction={sortDir}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {productNames.map((item) => (
                  <TableRowLink
                    key={item.id}
                    href={`/product-names/${item.id}/edit`}
                  >
                    <td>
                      <span className="code-pill">{item.code}</span>
                    </td>
                    <td>{item.nameRu}</td>
                    <td className="text-muted">{dash(item.nameEn)}</td>
                    <td className="text-muted">{dash(item.nameCn)}</td>
                    <td className="text-muted">{dash(item.category)}</td>
                    <td>
                      {item.hsCode?.trim() ? (
                        <>
                          <span className="code-pill">{item.hsCode}</span>
                          {item.hsDescription && (
                            <div className="hs-desc" title="Официальное описание EU CN 2026">
                              {item.hsDescription}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="hs-missing" title="HS-код не указан">—</span>
                      )}
                    </td>
                  </TableRowLink>
                ))}
                {productNames.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      Наименования не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            hrefForPage={(p) => productNamesHref({ search, sort }, { page: String(p) })}
          />
        </div>

      </Form>

      <style>{`
        .search-wrap { position: relative; width: 100%; max-width: 520px; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }
        .search-input { width: 100%; padding: 9px 12px 9px 36px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .search-input:focus { border-color: var(--color-accent); }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: top; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }

        .code-pill { display: inline-flex; align-items: center; justify-content: center; padding: 3px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--color-text); background: var(--color-muted-bg); white-space: nowrap; }
        .text-muted { color: var(--color-muted); }
        .hs-missing { color: var(--color-danger); font-weight: 600; }
        .hs-desc { font-size: 11.5px; color: var(--color-muted); margin-top: 4px; max-width: 240px; line-height: 1.35; }
        .btn-ghost { display: inline-flex; align-items: center; padding: 5px 10px; background: transparent; border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; color: var(--color-accent); text-decoration: none; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .btn-ghost:hover { background: color-mix(in srgb, var(--color-accent) 8%, transparent); }
        .row-clickable { cursor: pointer; }
        .row-clickable:hover td { background: var(--color-muted-bg); }
        .btn-sm { padding: 4px 8px; }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
      `}</style>
    </>
  );
}
