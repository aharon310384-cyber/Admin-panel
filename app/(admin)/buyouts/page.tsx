import type { Metadata } from "next";
import Link from "next/link";
import type { BuyoutKind, BuyoutStatus, Prisma } from "@prisma/client";
import { Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { BUYOUT_KIND_LABELS, BUYOUT_STATUS_COLOR, BUYOUT_STATUS_LABELS, buyoutStatusLabel } from "@/lib/statuses";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";
import { clientFields, readListSearch, searchConditions, searchParamsOf, type ServerSearchField } from "@/lib/list-search";
import { yuan } from "@/lib/buyout-money";
import { syncBuyoutsAtWarehouse } from "@/lib/buyouts";
import Form from "@/components/form/form";
import ListFilters from "@/components/form/list-filters";
import ClickableRow from "@/components/ui/clickable-row";
import SortableHeader from "@/components/ui/sortable-header";
import { BUYOUT_ADMIN_CSS } from "@/components/buyouts/admin-styles";

export const metadata: Metadata = { title: "Выкупы" };

// Журнал «Выкупы» (docs/product/задание-выкуп.md, раздел 5): заявки клиентов купить товар в Китае за них.
// Строка открывает карточку выкупа — там кнопки по статусу.

const SORT_FIELDS = ["createdAt", "number", "customerCode", "kind", "total", "status", "track"] as const;
type SortField = (typeof SORT_FIELDS)[number];

function orderBy(field: SortField, dir: SortDirection): Prisma.BuyoutOrderByWithRelationInput {
  switch (field) {
    case "number":
      return { number: dir };
    case "customerCode":
      return { customer: { code: dir } };
    case "kind":
      return { kind: dir };
    case "total":
      return { totalCny: { sort: dir, nulls: "last" } };
    case "status":
      return { status: dir };
    case "track":
      return { sellerTrack: { sort: dir, nulls: "last" } };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

const SEARCH_FIELDS: ServerSearchField<Prisma.BuyoutWhereInput>[] = [
  { key: "number", label: "Номер", where: (f) => ({ number: f }) },
  { key: "client", label: "Клиент", where: (f) => ({ customer: { OR: [{ code: f }, { name: f }] } }) },
  { key: "product", label: "Товар", where: (f) => ({ OR: [{ productName: f }, { variant: f }] }) },
  { key: "url", label: "Ссылка или контакт", where: (f) => ({ OR: [{ url: f }, { sellerContact: f }] }) },
  { key: "track", label: "Трек продавца", where: (f) => ({ sellerTrack: f }) },
  { key: "order", label: "Заказ", where: (f) => ({ order: { number: f } }) },
];
const LIMIT = 300;
const STATUSES = Object.keys(BUYOUT_STATUS_LABELS) as BuyoutStatus[];
const KINDS = Object.keys(BUYOUT_KIND_LABELS) as BuyoutKind[];

function day(value: string | undefined, plusDays = 0): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + plusDays);
  return date;
}

type Params = {
  sort?: string; q?: string; sf?: string; sv?: string; sm?: string;
  status?: string; kind?: string; client?: string; from?: string; to?: string; deleted?: string;
};

export default async function BuyoutsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  await syncBuyoutsAtWarehouse();
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");
  const search = readListSearch(params);
  const status = STATUSES.find((s) => s === params.status) ?? null;
  const kind = KINDS.find((k) => k === params.kind) ?? null;
  const from = day(params.from);
  const to = day(params.to, 1);
  const showDeleted = params.deleted === "1";

  const where: Prisma.BuyoutWhereInput = {
    ...(showDeleted ? {} : { deletedAt: null }),
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(params.client ? { customer: { code: params.client } } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    AND: searchConditions(search, SEARCH_FIELDS),
  };

  const [buyouts, total, waiting, clients] = await Promise.all([
    prisma.buyout.findMany({
      where,
      include: { customer: { select: { code: true, name: true } }, order: { select: { id: true, number: true } } },
      orderBy: orderBy(sortField, sortDir),
      take: LIMIT,
    }),
    prisma.buyout.count({ where }),
    prisma.buyout.groupBy({ by: ["status"], where: { deletedAt: null, status: { in: ["NEW", "PAID", "PURCHASED"] } }, _count: true }),
    prisma.customer.findMany({ where: { deletedAt: null, code: { not: null }, buyouts: { some: {} } }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const count = (s: BuyoutStatus) => waiting.find((w) => w.status === s)?._count ?? 0;

  const keep = {
    ...searchParamsOf(search),
    status: params.status, kind: params.kind, client: params.client, from: params.from, to: params.to, deleted: params.deleted,
  };
  const sortHref = (field: SortField) => {
    const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return buildListHref("/buyouts", keep, { sort: `${field}_${nextDir}` });
  };
  const header = (field: SortField, label: string) => (
    <SortableHeader label={label} href={sortHref(field)} active={sortField === field} direction={sortDir} />
  );

  return (
    <>
      <Form
        formKey="buyouts"
        title="Выкупы"
        search={{ fields: clientFields(SEARCH_FIELDS) }}
        commands={
          <Link href="/buyouts/settings" className="cmd" data-command="buyout-settings" data-label="Настройки выкупа">
            <Settings size={15} aria-hidden="true" />
            Настройки выкупа
          </Link>
        }
        header={
          <ListFilters
            filters={[
              { kind: "select", name: "status", label: "Статус", options: STATUSES.map((s) => ({ value: s, label: buyoutStatusLabel(s) })) },
              { kind: "select", name: "kind", label: "Вид", options: KINDS.map((k) => ({ value: k, label: BUYOUT_KIND_LABELS[k] })) },
              { kind: "select", name: "client", label: "Клиент", options: clients.map((c) => ({ value: c.code!, label: `${c.code} — ${c.name}` })) },
              { kind: "period", from: "from", to: "to", label: "Период" },
              { kind: "check", name: "deleted", label: "Показать удалённые" },
            ]}
          />
        }
        footer={
          <>
            {total > buyouts.length ? `Показаны ${buyouts.length} из ${total} — уточните поиск или отбор` : `${total} выкупов`} · ждут цену: {count("NEW")} ·
            ждут покупки: {count("PAID")} · ждут трек: {count("PURCHASED")}
          </>
        }
      >
        <div className="card">
          <div className="table-wrap">
            <table className="table table--wide">
              <thead>
                <tr>
                  <th>{header("createdAt", "Дата")}</th>
                  <th>{header("number", "Номер")}</th>
                  <th>{header("customerCode", "Клиент")}</th>
                  <th>{header("kind", "Вид")}</th>
                  <th>Товар</th>
                  <th className="num">{header("total", "Итого")}</th>
                  <th>{header("status", "Статус")}</th>
                  <th>{header("track", "Трек продавца")}</th>
                  <th>Заказ</th>
                </tr>
              </thead>
              <tbody>
                {buyouts.map((b) => (
                  <ClickableRow key={b.id} href={`/buyouts/${b.id}`} doc={{ entity: "buyout", id: b.id }} className={b.deletedAt ? "is-deleted" : undefined}>
                    <td className="muted">{formatDateTime(b.createdAt)}</td>
                    <td className="mono strong"><Link href={`/buyouts/${b.id}`}>{b.number}</Link></td>
                    <td><span className="code-pill">{b.customer.code ?? "—"}</span> {b.customer.name}</td>
                    <td className="muted">{BUYOUT_KIND_LABELS[b.kind]}</td>
                    <td className="clip" title={[b.productName, b.variant].filter(Boolean).join(" · ")}>
                      {b.productName}{b.variant ? <span className="muted"> · {b.variant}</span> : null} <span className="muted">× {b.quantity}</span>
                    </td>
                    <td className="num">{b.totalCny != null ? yuan(b.totalCny) : "—"}</td>
                    <td><span className={`st st--${BUYOUT_STATUS_COLOR[b.status]}`}>{buyoutStatusLabel(b.status)}</span></td>
                    <td className="mono">{b.sellerTrack ?? "—"}</td>
                    <td className="mono">{b.order ? <Link href={`/orders/${b.order.id}/edit`}>{b.order.number}</Link> : "—"}</td>
                  </ClickableRow>
                ))}
                {buyouts.length === 0 && (
                  <tr><td colSpan={9} className="table-empty">Выкупов нет — заявки приходят из кабинета клиента</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Form>
      <style>{BUYOUT_ADMIN_CSS}</style>
    </>
  );
}
