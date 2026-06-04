import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { auth } from "@/auth";
import { enterClientCabinet } from "@/actions/client-cabinet";
import { prisma } from "@/lib/prisma";
import SortableHeader from "@/components/ui/sortable-header";
import { Pagination } from "@/components/ui/pagination";
import { parsePageParam } from "@/lib/list-params";

export const metadata: Metadata = { title: "Клиенты" };

const LIMIT = 100;

type SearchParams = {
  page?: string;
  search?: string;
  sort?: string;
};

type SortDirection = "asc" | "desc";
type ClientSortField =
  | "code"
  | "name"
  | "phone"
  | "username"
  | "email"
  | "location"
  | "orders";

type ClientRow = {
  id: string;
  code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  country: string | null;
  city: string | null;
  orderCount: number;
};

function dash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function clientName(client: ClientRow): string {
  if (client.code && client.name.trim().toLowerCase() === client.code.trim().toLowerCase()) {
    return "—";
  }

  return dash(client.name);
}

function normalizeSort(sort: string | undefined): [ClientSortField, SortDirection] {
  const [field, direction] = (sort ?? "code_asc").split("_");
  const fields = new Set<ClientSortField>([
    "code",
    "name",
    "phone",
    "username",
    "email",
    "location",
    "orders",
  ]);

  return [
    fields.has(field as ClientSortField) ? (field as ClientSortField) : "code",
    direction === "desc" ? "desc" : "asc",
  ];
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return normalized(a).localeCompare(normalized(b), "ru", { sensitivity: "base" });
}

function compareClientField(a: ClientRow, b: ClientRow, field: ClientSortField): number {
  if (field === "location") {
    return compareText(a.country, b.country) || compareText(a.city, b.city);
  }

  if (field === "orders") {
    return a.orderCount - b.orderCount;
  }

  return compareText(a[field], b[field]);
}

function compareClients(
  a: ClientRow,
  b: ClientRow,
  field: ClientSortField,
  dir: SortDirection
): number {
  const result = compareClientField(a, b, field);
  if (result !== 0) {
    return dir === "asc" ? result : -result;
  }

  return compareText(a.code, b.code);
}

function clientsHref(
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
  return params ? `/clients?${params}` : "/clients";
}

export default async function ClientsPage({
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
    code: { not: null },
    ...(search
      ? {
          OR: [
            { code: { contains: search} },
            { name: { contains: search} },
            { phone: { contains: search} },
            { username: { contains: search} },
            { email: { contains: search} },
            { country: { contains: search} },
            { city: { contains: search} },
          ],
        }
      : {}),
  };

  const [clientRecords, orderGroups] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        phone: true,
        username: true,
        country: true,
        city: true,
      },
    }),
    prisma.parcel.groupBy({
      by: ["routePrefix"],
      where: { deletedAt: null, routePrefix: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const orderCounts = new Map<string, number>();
  for (const group of orderGroups) {
    const code = group.routePrefix?.trim().toUpperCase();
    if (code) {
      orderCounts.set(code, (orderCounts.get(code) ?? 0) + group._count._all);
    }
  }

  const allClients: ClientRow[] = clientRecords.map((client) => ({
    ...client,
    orderCount: client.code ? orderCounts.get(client.code.trim().toUpperCase()) ?? 0 : 0,
  }));
  allClients.sort((a, b) => compareClients(a, b, sortField, sortDir));

  const total = allClients.length;
  const clients = allClients.slice((page - 1) * LIMIT, page * LIMIT);
  const totalPages = Math.ceil(total / LIMIT);
  const sortHref = (field: ClientSortField, defaultDirection: SortDirection = "asc") => {
    const nextDirection =
      sortField === field ? (sortDir === "asc" ? "desc" : "asc") : defaultDirection;
    return clientsHref({ search, sort }, { sort: `${field}_${nextDirection}`, page: null });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Клиенты</h1>
          <p className="page-subtitle">{total} клиентских кодов из вкладки Клиенты</p>
        </div>
      </div>

      <div className="search-wrap">
        <Search size={15} className="search-icon" />
        <form>
          <input type="hidden" name="sort" value={`${sortField}_${sortDir}`} />
          <input
            type="search"
            name="search"
            placeholder="Поиск по коду, имени, телефону, email, стране или городу..."
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
                    href={sortHref("code")}
                    active={sortField === "code"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Клиент"
                    href={sortHref("name")}
                    active={sortField === "name"}
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
                    label="Telegram"
                    href={sortHref("username")}
                    active={sortField === "username"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Email"
                    href={sortHref("email")}
                    active={sortField === "email"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Страна / город"
                    href={sortHref("location")}
                    active={sortField === "location"}
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
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <span className="code-pill">{client.code}</span>
                  </td>
                  <td>{clientName(client)}</td>
                  <td className="text-muted">{dash(client.phone)}</td>
                  <td className="text-muted">{dash(client.username)}</td>
                  <td className="text-muted">{dash(client.email)}</td>
                  <td className="text-muted">
                    {[client.country, client.city].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="tabular">{client.orderCount}</td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/clients/${client.id}`} className="btn-ghost btn-sm">
                        Открыть
                      </Link>
                      {isAdmin && (
                        <form action={enterClientCabinet.bind(null, client.id)}>
                          <button type="submit" className="btn-ghost btn-sm">
                            Войти как клиент
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty">
                    Клиентские коды не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          hrefForPage={(p) => clientsHref({ search, sort }, { page: String(p) })}
        />
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }

        .search-wrap { position: relative; max-width: 520px; }
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

        .code-pill { display: inline-flex; align-items: center; min-width: 40px; justify-content: center; padding: 3px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--color-text); background: var(--color-muted-bg); }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }

        .btn-ghost { display: inline-flex; align-items: center; padding: 5px 10px; background: transparent; border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; color: var(--color-accent); text-decoration: none; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .btn-ghost:hover { background: oklch(52% 0.14 42 / 0.08); }
        .btn-sm { padding: 4px 8px; }
        .row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
        .row-actions form { margin: 0; }

        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }

      `}</style>
    </div>
  );
}
