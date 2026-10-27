import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import ClickableRow from "@/components/ui/clickable-row";
import SortableHeader from "@/components/ui/sortable-header";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";
import Form from "@/components/form/form";
import { clientFields, readListSearch, searchConditions, searchParamsOf, type ServerSearchField } from "@/lib/list-search";

export const metadata: Metadata = { title: "Клиенты" };

function dash(v: string | null | undefined): string {
  return v?.trim() || "—";
}

const SORT_FIELDS = [
  "code",
  "name",
  "phone",
  "email",
  "country",
  "city",
  "recipientsCount",
  "ordersCount",
  "parcelsCount",
  "createdAt",
] as const;
type SortField = (typeof SORT_FIELDS)[number];

function clientOrderBy(field: SortField, dir: SortDirection): Prisma.CustomerOrderByWithRelationInput {
  switch (field) {
    case "recipientsCount":
      return { recipients: { _count: dir } };
    case "ordersCount":
      return { orders: { _count: dir } };
    case "parcelsCount":
      return { parcels: { _count: dir } };
    case "code":
      return { code: dir };
    case "name":
      return { name: dir };
    case "phone":
      return { phone: dir };
    case "email":
      return { email: dir };
    case "country":
      return { country: dir };
    case "city":
      return { city: dir };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

// Поиск списка (строка поиска и «Расширенный поиск»): подписи — как заголовки столбцов таблицы.
const SEARCH_FIELDS: ServerSearchField<Prisma.CustomerWhereInput>[] = [
  { key: "code", label: "Код", where: (f) => ({ code: f }) },
  { key: "name", label: "Имя", where: (f) => ({ name: f }) },
  { key: "phone", label: "Телефон", where: (f) => ({ phone: f }) },
  { key: "email", label: "Email", where: (f) => ({ email: f }) },
  { key: "country", label: "Страна", where: (f) => ({ country: f }) },
  { key: "city", label: "Город", where: (f) => ({ city: f }) },
];
const LIMIT = 300;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string; sf?: string; sv?: string; sm?: string }>;
}) {
  const params = await searchParams;
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");
  const search = readListSearch(params);
  const where: Prisma.CustomerWhereInput = { deletedAt: null, AND: searchConditions(search, SEARCH_FIELDS) };

  const [clients, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        _count: { select: { orders: { where: { deletedAt: null } }, parcels: { where: { deletedAt: null } }, recipients: true } },
      },
      orderBy: clientOrderBy(sortField, sortDir),
      take: LIMIT,
    }),
    prisma.customer.count({ where }),
  ]);

  const sortHref = (field: SortField) => {
    const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return buildListHref("/clients", searchParamsOf(search), { sort: `${field}_${nextDir}` });
  };

  return (
    <>
      <Form
        formKey="clients"
        title="Клиенты"
        commands={
          <>
            <Link href="/clients/new" className="cmd cmd--primary" data-command="create">
              <Plus size={15} />
              Создать
            </Link>
            <Link href="/clients/import" className="cmd" data-command="import" title="Обновить список клиентов из файла Excel">
              <FileSpreadsheet size={15} />
              Загрузить из Excel
            </Link>
          </>
        }
        search={{ fields: clientFields(SEARCH_FIELDS) }}
        footer={<>{total > clients.length ? `Показаны ${clients.length} из ${total} — уточните поиск (Ctrl+F)` : `${total} клиентов`}</>}
      >
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th><SortableHeader label="Код" href={sortHref("code")} active={sortField === "code"} direction={sortDir} /></th>
                  <th><SortableHeader label="Имя" href={sortHref("name")} active={sortField === "name"} direction={sortDir} /></th>
                  <th><SortableHeader label="Телефон" href={sortHref("phone")} active={sortField === "phone"} direction={sortDir} /></th>
                  <th><SortableHeader label="Email" href={sortHref("email")} active={sortField === "email"} direction={sortDir} /></th>
                  <th><SortableHeader label="Страна" href={sortHref("country")} active={sortField === "country"} direction={sortDir} /></th>
                  <th><SortableHeader label="Город" href={sortHref("city")} active={sortField === "city"} direction={sortDir} /></th>
                  <th><SortableHeader label="Получателей" href={sortHref("recipientsCount")} active={sortField === "recipientsCount"} direction={sortDir} /></th>
                  <th><SortableHeader label="Заказов" href={sortHref("ordersCount")} active={sortField === "ordersCount"} direction={sortDir} /></th>
                  <th><SortableHeader label="Посылок" href={sortHref("parcelsCount")} active={sortField === "parcelsCount"} direction={sortDir} /></th>
                  <th><SortableHeader label="Создан" href={sortHref("createdAt")} active={sortField === "createdAt"} direction={sortDir} /></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <ClickableRow key={c.id} href={`/clients/${c.id}`}>
                    <td><span className="code-pill">{dash(c.code)}</span></td>
                    <td className="strong">{c.name}</td>
                    <td className="mono text-muted">{dash(c.phone)}</td>
                    <td className="text-muted">{dash(c.email)}</td>
                    <td className="text-muted">{dash(c.country)}</td>
                    <td className="text-muted">{dash(c.city)}</td>
                    <td className="tabular">{c._count.recipients}</td>
                    <td className="tabular">{c._count.orders}</td>
                    <td className="tabular">{c._count.parcels}</td>
                    <td className="text-muted">{formatDateTime(c.createdAt)}</td>
                  </ClickableRow>
                ))}
                {clients.length === 0 && (
                  <tr><td colSpan={10} className="table-empty">Клиентов пока нет</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Form>

      <style>{`
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { min-width: 900px; width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); white-space: nowrap; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .strong { font-weight: 600; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }
        .code-pill { display: inline-flex; min-width: 36px; justify-content: center; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); color: var(--color-text); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
      `}</style>
    </>
  );
}
