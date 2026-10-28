import type { Metadata } from "next";
import Link from "next/link";
import type { ParcelTaskStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { TASK_STATUS_COLOR, TASK_STATUS_LABELS, taskStatusLabel } from "@/lib/statuses";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";
import { clientFields, readListSearch, searchConditions, searchParamsOf, type ServerSearchField } from "@/lib/list-search";
import Form from "@/components/form/form";
import ListFilters from "@/components/form/list-filters";
import ClickableRow from "@/components/ui/clickable-row";
import SortableHeader from "@/components/ui/sortable-header";

export const metadata: Metadata = { title: "Задачи" };

// Журнал «Задачи на формирование посылки» (docs/product/задание-журналы.md, шаг 1): только просмотр.
// Задачи создаются загрузкой из Excel и оформлением заказов; строка открывает карточку задачи.

const SORT_FIELDS = ["createdAt", "number", "customerCode", "country", "status", "ordersCount", "parcelNumber"] as const;
type SortField = (typeof SORT_FIELDS)[number];

function taskOrderBy(field: SortField, dir: SortDirection): Prisma.ParcelTaskOrderByWithRelationInput {
  switch (field) {
    case "number":
      return { number: dir };
    case "customerCode":
      return { customer: { code: dir } };
    case "country":
      return { destinationCountry: dir };
    case "status":
      return { status: dir };
    case "ordersCount":
      return { orders: { _count: dir } };
    case "parcelNumber":
      return { parcel: { number: dir } };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

// Поиск списка (строка поиска и «Расширенный поиск»): подписи — как заголовки столбцов таблицы.
const SEARCH_FIELDS: ServerSearchField<Prisma.ParcelTaskWhereInput>[] = [
  { key: "number", label: "Номер", where: (f) => ({ number: f }) },
  { key: "client", label: "Клиент", where: (f) => ({ customer: { OR: [{ code: f }, { name: f }] } }) },
  { key: "parcel", label: "Посылка", where: (f) => ({ parcel: { OR: [{ number: f }, { trackingNumber: f }] } }) },
  { key: "note", label: "Примечание", where: (f) => ({ OR: [{ note: f }, { internalComment: f }] }) },
  { key: "track", label: "Входящий трек-номер", where: (f) => ({ orders: { some: { trackNumber: f } } }) },
];
const LIMIT = 300;
const STATUSES = Object.keys(TASK_STATUS_LABELS) as ParcelTaskStatus[];

/** «2026-10-27» → начало этого дня; не дата — нет отбора. */
function day(value: string | undefined, plusDays = 0): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + plusDays);
  return date;
}

type Params = {
  sort?: string; q?: string; sf?: string; sv?: string; sm?: string;
  status?: string; client?: string; country?: string; from?: string; to?: string; deleted?: string;
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");
  const search = readListSearch(params);
  const status = STATUSES.find((s) => s === params.status) ?? null;
  const from = day(params.from);
  const to = day(params.to, 1);
  const showDeleted = params.deleted === "1";

  const where: Prisma.ParcelTaskWhereInput = {
    ...(showDeleted ? {} : { deletedAt: null }),
    ...(status ? { status } : {}),
    ...(params.client ? { customer: { code: params.client } } : {}),
    ...(params.country ? { destinationCountry: params.country } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    AND: searchConditions(search, SEARCH_FIELDS),
  };

  const [tasks, total, clients, countryCodes] = await Promise.all([
    prisma.parcelTask.findMany({
      where,
      include: {
        customer: { select: { code: true, name: true } },
        createdBy: { select: { name: true } },
        parcel: { select: { id: true, number: true } },
        _count: { select: { orders: { where: { deletedAt: null } } } },
      },
      orderBy: taskOrderBy(sortField, sortDir),
      take: LIMIT,
    }),
    prisma.parcelTask.count({ where }),
    prisma.customer.findMany({ where: { deletedAt: null, code: { not: null } }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.parcelTask.findMany({ where: { destinationCountry: { not: null } }, select: { destinationCountry: true }, distinct: ["destinationCountry"] }),
  ]);
  const countries = await prisma.country.findMany({
    where: { code: { in: countryCodes.map((c) => c.destinationCountry!).filter(Boolean) } },
    select: { code: true, nameEn: true },
    orderBy: { code: "asc" },
  });
  const countryName = new Map(countries.map((c) => [c.code, c.nameEn]));

  const keep = {
    ...searchParamsOf(search),
    status: params.status, client: params.client, country: params.country, from: params.from, to: params.to, deleted: params.deleted,
  };
  const sortHref = (field: SortField) => {
    const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return buildListHref("/tasks", keep, { sort: `${field}_${nextDir}` });
  };
  const header = (field: SortField, label: string) => (
    <SortableHeader label={label} href={sortHref(field)} active={sortField === field} direction={sortDir} />
  );

  return (
    <>
      <Form
        formKey="tasks"
        title="Задачи"
        search={{ fields: clientFields(SEARCH_FIELDS) }}
        header={
          <ListFilters
            filters={[
              { kind: "select", name: "status", label: "Статус", options: STATUSES.map((s) => ({ value: s, label: taskStatusLabel(s) })) },
              { kind: "select", name: "client", label: "Клиент", options: clients.map((c) => ({ value: c.code!, label: `${c.code} — ${c.name}` })) },
              { kind: "select", name: "country", label: "Страна", options: countries.map((c) => ({ value: c.code, label: `${c.code} — ${c.nameEn}` })) },
              { kind: "period", from: "from", to: "to", label: "Период" },
              { kind: "check", name: "deleted", label: "Показать удалённые" },
            ]}
          />
        }
        footer={
          <>
            {total > tasks.length ? `Показаны ${tasks.length} из ${total} — уточните поиск или отбор` : `${total} задач`} · только просмотр: задачи
            создаются загрузкой из Excel и оформлением заказов
          </>
        }
      >
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{header("createdAt", "Дата")}</th>
                  <th>{header("number", "Номер")}</th>
                  <th>{header("customerCode", "Клиент")}</th>
                  <th>{header("country", "Страна")}</th>
                  <th>{header("status", "Статус")}</th>
                  <th className="num">{header("ordersCount", "Заказов")}</th>
                  <th>{header("parcelNumber", "Посылка")}</th>
                  <th>Примечание</th>
                  <th>Автор</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <ClickableRow key={t.id} href={`/tasks/${t.id}`} doc={{ entity: "task", id: t.id }} className={t.deletedAt ? "is-deleted" : undefined}>
                    <td className="text-muted">{formatDateTime(t.createdAt)}</td>
                    <td className="mono strong">{t.number}</td>
                    <td>
                      <span className="code-pill">{t.customer.code ?? "—"}</span> {t.customer.name}
                    </td>
                    <td className="text-muted">{t.destinationCountry ? `${t.destinationCountry} — ${countryName.get(t.destinationCountry) ?? ""}` : "—"}</td>
                    <td><span className={`st st--${TASK_STATUS_COLOR[t.status]}`}>{taskStatusLabel(t.status)}</span></td>
                    <td className="num">{t._count.orders}</td>
                    <td className="mono">{t.parcel ? <Link href={`/parcels/${t.parcel.id}`}>{t.parcel.number}</Link> : "—"}</td>
                    <td className="text-muted note" title={t.note ?? undefined}>{t.note || "—"}</td>
                    <td className="text-muted">{t.createdBy.name}</td>
                  </ClickableRow>
                ))}
                {tasks.length === 0 && (
                  <tr><td colSpan={9} className="table-empty">Задач нет</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Form>

      <style>{`
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { min-width: 1000px; width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); white-space: nowrap; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .table tr.is-deleted td { color: var(--color-muted); text-decoration: line-through; }
        .table td a { color: var(--color-accent); text-decoration: none; }
        .table td a:hover { text-decoration: underline; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .note { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
        .strong { font-weight: 600; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .text-muted { color: var(--color-muted); }
        .code-pill { display: inline-flex; min-width: 36px; justify-content: center; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); color: var(--color-text); }
        .st { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
        .st--new { color: var(--color-status-new); background: var(--color-status-new-bg); }
        .st--processing { color: var(--color-status-processing); background: var(--color-status-processing-bg); }
        .st--assembled { color: var(--color-status-assembled); background: var(--color-status-assembled-bg); }
        .st--ready { color: var(--color-status-ready); background: var(--color-status-ready-bg); }
        .st--completed { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .st--canceled { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
      `}</style>
    </>
  );
}
