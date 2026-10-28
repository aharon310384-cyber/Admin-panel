import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronRight, Folder, FolderPlus, Pencil, Plus, Search } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { productGroupPath } from "@/lib/products";
import SortableHeader from "@/components/ui/sortable-header";
import { Pagination } from "@/components/ui/pagination";
import TableRowLink from "@/components/ui/table-row-link";
import { parsePageParam } from "@/lib/list-params";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Наименования товаров" };

const LIMIT = 50;

// Справочник — как «Номенклатура» в 1С: открыта одна группа (папка), в ней сначала группы, потом товары.
// Двойной щелчок по группе открывает её, по товару — карточку. Поиск ищет по всем группам.

type SearchParams = {
  page?: string;
  search?: string;
  sort?: string;
  group?: string;
};

type SortDirection = "asc" | "desc";
type ProductNameSortField = "code" | "nameRu" | "nameEn" | "nameCn" | "hsCode" | "createdAt";

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
    "hsCode",
    "createdAt",
  ]);

  return [
    fields.has(field as ProductNameSortField) ? (field as ProductNameSortField) : "code",
    direction === "desc" ? "desc" : "asc",
  ];
}

function productNamesHref(
  values: { search?: string; sort?: string; page?: string; group?: string },
  overrides: { search?: string; sort?: string; page?: string | null; group?: string | null }
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
  // группы — всегда над товарами
  return [{ isGroup: "desc" }, { [field]: direction }, { code: "asc" }];
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

  // открытая группа: путь от верхнего уровня; при поиске — все группы сразу
  const path = !search && params.group ? await productGroupPath(params.group) : [];
  const group = path.at(-1);
  const groupParam = group?.id;

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { nameRu: { contains: search, mode: "insensitive" } },
            { nameEn: { contains: search, mode: "insensitive" } },
            { nameCn: { contains: search, mode: "insensitive" } },
            { hsCode: { contains: search, mode: "insensitive" } },
            { parent: { is: { nameRu: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : { parentId: group?.id ?? null }),
  } satisfies Prisma.ProductNameWhereInput;

  const [productNames, total, groupCount] = await Promise.all([
    prisma.productName.findMany({
      where,
      orderBy: productNameOrderBy(sortField, sortDir),
      skip: (page - 1) * LIMIT,
      take: LIMIT,
      include: {
        parent: { select: { nameRu: true } },
        _count: { select: { children: { where: { deletedAt: null } } } },
      },
    }),
    prisma.productName.count({ where }),
    prisma.productName.count({ where: { ...where, isGroup: true } }),
  ]);

  const totalPages = Math.ceil(total / LIMIT);
  const current = { search, sort: params.sort, group: groupParam };
  const sortHref = (field: ProductNameSortField, defaultDirection: SortDirection = "asc") => {
    const nextDirection =
      sortField === field ? (sortDir === "asc" ? "desc" : "asc") : defaultDirection;
    return productNamesHref(current, { sort: `${field}_${nextDirection}`, page: null });
  };
  const groupHref = (id: string | null) => productNamesHref({ sort: params.sort }, { group: id });
  const createQuery = groupParam ? `&parent=${groupParam}` : "";

  return (
    <>
      <Form
        formKey="product-names"
        title="Наименования товаров"
        commands={
          isAdmin && (
            <>
              <Link
                href={`/product-names/new${groupParam ? `?parent=${groupParam}` : ""}`}
                className="cmd cmd--primary"
                data-command="create"
              >
                <Plus size={15} />
                Создать
              </Link>
              <Link
                href={`/product-names/new?type=group${createQuery}`}
                className="cmd"
                data-command="create-group"
              >
                <FolderPlus size={15} />
                Создать группу
              </Link>
            </>
          )
        }
        header={
          <div className="pn-header">
            <div className="search-wrap">
              <Search size={15} className="search-icon" />
              <form>
                <input type="hidden" name="sort" value={`${sortField}_${sortDir}`} />
                <input
                  type="search"
                  name="search"
                  placeholder="Поиск по всем группам: код, наименование, группа, HS-код..."
                  defaultValue={search}
                  className="search-input"
                />
              </form>
            </div>
            {search ? (
              <p className="pn-crumbs">
                Найдено во всех группах ·{" "}
                <Link href={productNamesHref({ sort: params.sort }, {})} className="pn-crumb">
                  сбросить поиск
                </Link>
              </p>
            ) : (
              <nav className="pn-crumbs" aria-label="Группы">
                {group ? (
                  <Link href={groupHref(null)} className="pn-crumb">
                    Все группы
                  </Link>
                ) : (
                  <span className="pn-crumb-current">Все группы</span>
                )}
                {path.map((item) => (
                  <span key={item.id} className="pn-crumb-step">
                    <ChevronRight size={13} />
                    {item.id === group?.id ? (
                      <span className="pn-crumb-current">{item.nameRu}</span>
                    ) : (
                      <Link href={groupHref(item.id)} className="pn-crumb">
                        {item.nameRu}
                      </Link>
                    )}
                  </span>
                ))}
              </nav>
            )}
          </div>
        }
        footer={
          <>
            Групп: {groupCount} · товаров: {total - groupCount}
            {search ? " (найдено)" : group ? " в группе" : " на верхнем уровне"}
          </>
        }
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
                      label="HS-код"
                      href={sortHref("hsCode")}
                      active={sortField === "hsCode"}
                      direction={sortDir}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {productNames.map((item) =>
                  item.isGroup ? (
                    <TableRowLink key={item.id} href={groupHref(item.id)} className="row-group">
                      <td>
                        <span className="code-pill">{item.code}</span>
                      </td>
                      <td>
                        <span className="pn-group-name">
                          <Link href={groupHref(item.id)} className="pn-group-link" title="Открыть группу">
                            <Folder size={15} className="pn-folder" />
                            {item.nameRu}
                          </Link>
                          <span className="text-muted">({item._count.children})</span>
                          {isAdmin && (
                            <Link
                              href={`/product-names/${item.id}/edit`}
                              className="pn-edit"
                              title="Изменить группу"
                              aria-label="Изменить группу"
                            >
                              <Pencil size={13} />
                            </Link>
                          )}
                        </span>
                        {search && item.parent && (
                          <div className="pn-parent">в группе «{item.parent.nameRu}»</div>
                        )}
                      </td>
                      <td className="text-muted">{dash(item.nameEn)}</td>
                      <td className="text-muted">{dash(item.nameCn)}</td>
                      <td />
                    </TableRowLink>
                  ) : (
                    <TableRowLink key={item.id} href={`/product-names/${item.id}/edit`}>
                      <td>
                        <span className="code-pill">{item.code}</span>
                      </td>
                      <td>
                        {item.nameRu}
                        {search && item.parent && (
                          <div className="pn-parent">в группе «{item.parent.nameRu}»</div>
                        )}
                      </td>
                      <td className="text-muted">{dash(item.nameEn)}</td>
                      <td className="text-muted">{dash(item.nameCn)}</td>
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
                  )
                )}
                {productNames.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      {search ? "Ничего не найдено" : "В группе пока пусто"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            hrefForPage={(p) => productNamesHref(current, { page: String(p) })}
          />
        </div>

      </Form>

      <style>{`
        .pn-header { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .search-wrap { position: relative; width: 100%; max-width: 520px; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }
        .search-input { width: 100%; padding: 9px 12px 9px 36px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .search-input:focus { border-color: var(--color-accent); }

        .pn-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 0; font-size: 13px; color: var(--color-muted); }
        .pn-crumb-step { display: inline-flex; align-items: center; gap: 4px; }
        .pn-crumb { color: var(--color-accent); text-decoration: none; }
        .pn-crumb:hover { text-decoration: underline; }
        .pn-crumb-current { color: var(--color-text); font-weight: 600; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: top; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }

        .pn-group-name { display: inline-flex; align-items: center; gap: 6px; }
        .pn-group-link { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--color-text); text-decoration: none; }
        .pn-group-link:hover { color: var(--color-accent); }
        .pn-folder { color: var(--color-accent); flex-shrink: 0; }
        .pn-edit { display: inline-flex; padding: 3px; border-radius: var(--radius-sm); color: var(--color-muted); }
        .pn-edit:hover { color: var(--color-accent); background: var(--color-muted-bg); }
        .pn-parent { font-size: 11.5px; color: var(--color-muted); margin-top: 3px; }

        .code-pill { display: inline-flex; align-items: center; justify-content: center; padding: 3px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--color-text); background: var(--color-muted-bg); white-space: nowrap; }
        .text-muted { color: var(--color-muted); }
        .hs-missing { color: var(--color-danger); font-weight: 600; }
        .hs-desc { font-size: 11.5px; color: var(--color-muted); margin-top: 4px; max-width: 240px; line-height: 1.35; }
        .row-clickable { cursor: pointer; }
        .row-clickable:hover td { background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
      `}</style>
    </>
  );
}
