import type { Metadata } from "next";
import Link from "next/link";
import type { Customer } from "@prisma/client";
import { Search } from "lucide-react";
import SortableHeader from "@/components/ui/sortable-header";
import { Pagination } from "@/components/ui/pagination";
import { prisma } from "@/lib/prisma";
import { parsePageParam } from "@/lib/list-params";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Получатели" };

const LIMIT = 20;

type SearchParams = {
  page?: string;
  search?: string;
  sort?: string;
};

type SortDirection = "asc" | "desc";
type CustomerSortField =
  | "clientCode"
  | "lastName"
  | "firstName"
  | "middleName"
  | "country"
  | "city"
  | "postalCode"
  | "address"
  | "phone"
  | "informationDate"
  | "orders";

type CustomerRow = Customer & {
  _count: { parcels: number };
};

function normalizeSort(sort: string | undefined): [CustomerSortField, SortDirection] {
  const [field, direction] = (sort ?? "informationDate_desc").split("_");
  const fields = new Set<CustomerSortField>([
    "clientCode",
    "lastName",
    "firstName",
    "middleName",
    "country",
    "city",
    "postalCode",
    "address",
    "phone",
    "informationDate",
    "orders",
  ]);

  return [
    fields.has(field as CustomerSortField) ? (field as CustomerSortField) : "informationDate",
    direction === "asc" ? "asc" : "desc",
  ];
}

function customersHref(
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
  return params ? `/recipients?${params}` : "/recipients";
}

function dash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['`’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePostalCode(value: string | null | undefined): string {
  return normalizeIdentity(value).replace(/[\s-]/g, "");
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function duplicateKey(customer: CustomerRow): string {
  const fallbackName = customer.lastName || customer.name;

  return [
    normalizeIdentity(customer.clientCode ?? customer.code),
    normalizeIdentity(fallbackName),
    normalizeIdentity(customer.firstName),
    normalizeIdentity(customer.middleName),
    normalizeIdentity(customer.country),
    normalizeIdentity(customer.city),
    normalizePostalCode(customer.postalCode),
    normalizePhone(customer.phone),
  ].join("|");
}

function rowScore(customer: CustomerRow): number {
  const informationTime = customer.informationDate?.getTime() ?? 0;
  const sourceRow = customer.sourceRow ?? 0;
  const completeness = [
    customer.address,
    customer.phone,
    customer.postalCode,
    customer.country,
    customer.city,
  ].filter(Boolean).length;

  return informationTime * 100000 + sourceRow * 10 + completeness;
}

function dedupeCustomers(customers: CustomerRow[]): CustomerRow[] {
  const byKey = new Map<string, CustomerRow>();

  for (const customer of customers) {
    const key = duplicateKey(customer);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, customer);
      continue;
    }

    const parcels = existing._count.parcels + customer._count.parcels;
    const preferred = rowScore(customer) > rowScore(existing) ? customer : existing;
    byKey.set(key, { ...preferred, _count: { parcels } });
  }

  return [...byKey.values()];
}

function formatInformationDate(date: Date | null, text: string | null): string {
  if (date) {
    return formatDateTime(date);
  }

  return dash(text);
}

function sortValue(customer: CustomerRow, field: CustomerSortField): string | number | null {
  if (field === "orders") {
    return customer._count.parcels;
  }
  if (field === "informationDate") {
    return customer.informationDate?.getTime() ?? null;
  }

  return customer[field];
}

function compareCustomers(
  field: CustomerSortField,
  direction: SortDirection
): (left: CustomerRow, right: CustomerRow) => number {
  return (left, right) => {
    const leftValue = sortValue(left, field);
    const rightValue = sortValue(right, field);
    const leftEmpty = leftValue === null || leftValue === "";
    const rightEmpty = rightValue === null || rightValue === "";

    if (leftEmpty && !rightEmpty) {
      return 1;
    }
    if (!leftEmpty && rightEmpty) {
      return -1;
    }
    if (leftEmpty && rightEmpty) {
      return (right.sourceRow ?? 0) - (left.sourceRow ?? 0);
    }

    const multiplier = direction === "asc" ? 1 : -1;
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * multiplier || (right.sourceRow ?? 0) - (left.sourceRow ?? 0);
    }

    return (
      String(leftValue).localeCompare(String(rightValue), ["ru", "en"], {
        sensitivity: "base",
        numeric: true,
      }) * multiplier ||
      (right.sourceRow ?? 0) - (left.sourceRow ?? 0)
    );
  };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "informationDate_desc";
  const [sortField, sortDir] = normalizeSort(sort);

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { clientCode: { contains: search} },
            { name: { contains: search} },
            { lastName: { contains: search} },
            { firstName: { contains: search} },
            { middleName: { contains: search} },
            { phone: { contains: search} },
            { country: { contains: search} },
            { city: { contains: search} },
            { postalCode: { contains: search} },
            { address: { contains: search} },
          ],
        }
      : {}),
  };

  const customers = await prisma.customer.findMany({
    where,
    include: {
      _count: { select: { parcels: { where: { deletedAt: null } } } },
    },
  });

  const uniqueCustomers = dedupeCustomers(customers).sort(
    compareCustomers(sortField, sortDir)
  );
  const total = uniqueCustomers.length;
  const visibleCustomers = uniqueCustomers.slice((page - 1) * LIMIT, page * LIMIT);
  const duplicateCount = customers.length - uniqueCustomers.length;

  const totalPages = Math.ceil(total / LIMIT);
  const sortHref = (
    field: CustomerSortField,
    defaultDirection: SortDirection = "asc"
  ) => {
    const nextDirection =
      sortField === field ? (sortDir === "asc" ? "desc" : "asc") : defaultDirection;
    return customersHref({ search, sort }, { sort: `${field}_${nextDirection}`, page: null });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Получатели</h1>
          <p className="page-subtitle">
            {total} уникальных получателей из ALL 6
            {duplicateCount > 0 ? `, скрыто дублей: ${duplicateCount}` : ""}
          </p>
        </div>
      </div>

      <div className="search-wrap">
        <Search size={15} className="search-icon" />
        <form>
          <input type="hidden" name="sort" value={`${sortField}_${sortDir}`} />
          <input
            type="search"
            name="search"
            placeholder="Поиск по коду клиента, ФИО, телефону, стране, городу, индексу или адресу..."
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
                <th>
                  <SortableHeader
                    label="КОД_КЛИЕНТА"
                    href={sortHref("clientCode")}
                    active={sortField === "clientCode"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Фамилия"
                    href={sortHref("lastName")}
                    active={sortField === "lastName"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Имя"
                    href={sortHref("firstName")}
                    active={sortField === "firstName"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Отчество"
                    href={sortHref("middleName")}
                    active={sortField === "middleName"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Страна"
                    href={sortHref("country")}
                    active={sortField === "country"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Населенный пункт"
                    href={sortHref("city")}
                    active={sortField === "city"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Почтовый код"
                    href={sortHref("postalCode")}
                    active={sortField === "postalCode"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Адрес"
                    href={sortHref("address")}
                    active={sortField === "address"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Телефон"
                    href={sortHref("phone")}
                    active={sortField === "phone"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Дата внесения"
                    href={sortHref("informationDate", "desc")}
                    active={sortField === "informationDate"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Посылок"
                    href={sortHref("orders", "desc")}
                    active={sortField === "orders"}
                    direction={sortDir}
                  />
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <span className="code-pill">{dash(customer.clientCode ?? customer.code)}</span>
                  </td>
                  <td>{dash(customer.lastName ?? customer.name)}</td>
                  <td>{dash(customer.firstName)}</td>
                  <td>{dash(customer.middleName)}</td>
                  <td className="text-muted">{dash(customer.country)}</td>
                  <td className="text-muted">{dash(customer.city)}</td>
                  <td className="mono text-muted">{dash(customer.postalCode)}</td>
                  <td className="address-cell">{dash(customer.address)}</td>
                  <td className="text-muted">{dash(customer.phone)}</td>
                  <td className="text-muted">
                    {formatInformationDate(customer.informationDate, customer.informationDateText)}
                  </td>
                  <td className="tabular">{customer._count.parcels}</td>
                  <td>
                    <Link href={`/recipients/${customer.id}`} className="btn-ghost btn-sm">
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
              {visibleCustomers.length === 0 && (
                <tr>
                  <td colSpan={12} className="table-empty">
                    Получателей не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          hrefForPage={(p) => customersHref({ search, sort }, { page: String(p) })}
        />
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }

        .search-wrap { position: relative; max-width: 620px; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }
        .search-input { width: 100%; padding: 9px 12px 9px 36px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .search-input:focus { border-color: var(--color-accent); }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { min-width: 1540px; width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: top; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }

        .code-pill { display: inline-flex; align-items: center; min-width: 42px; justify-content: center; padding: 3px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--color-text); background: var(--color-muted-bg); }
        .address-cell { max-width: 320px; min-width: 260px; color: var(--color-text); }
        .tabular { font-variant-numeric: tabular-nums; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .text-muted { color: var(--color-muted); }

        .btn-ghost { display: inline-flex; align-items: center; padding: 5px 10px; background: transparent; border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; color: var(--color-accent); text-decoration: none; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .btn-ghost:hover { background: oklch(52% 0.14 42 / 0.08); }
        .btn-sm { padding: 4px 8px; }

        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }

      `}</style>
    </div>
  );
}
