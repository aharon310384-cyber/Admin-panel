import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, TopUpRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { TOP_UP_STATUS_COLOR, TOP_UP_STATUS_LABELS } from "@/lib/statuses";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";
import { clientFields, readListSearch, searchConditions, searchParamsOf, type ServerSearchField } from "@/lib/list-search";
import { yuan } from "@/lib/purchase-money";
import Form from "@/components/form/form";
import ListFilters from "@/components/form/list-filters";
import ClickableRow from "@/components/ui/clickable-row";
import SortableHeader from "@/components/ui/sortable-header";
import { PURCHASE_ADMIN_CSS } from "@/components/purchases/admin-styles";

export const metadata: Metadata = { title: "Заявки на пополнение" };

// Журнал «Заявки на пополнение баланса» (PB-…): клиент присылает оплату из кабинета, администратор проверяет
// и зачисляет в карточке заявки. Правила безопасности денег — actions/top-ups.ts.

const SORT_FIELDS = ["createdAt", "number", "customerCode", "amount", "status"] as const;
type SortField = (typeof SORT_FIELDS)[number];

function orderBy(field: SortField, dir: SortDirection): Prisma.TopUpRequestOrderByWithRelationInput {
  switch (field) {
    case "number":
      return { number: dir };
    case "customerCode":
      return { customer: { code: dir } };
    case "amount":
      return { amount: dir };
    case "status":
      return { status: dir };
    default:
      return { createdAt: dir };
  }
}

const SEARCH_FIELDS: ServerSearchField<Prisma.TopUpRequestWhereInput>[] = [
  { key: "number", label: "Номер", where: (f) => ({ number: f }) },
  { key: "client", label: "Клиент", where: (f) => ({ customer: { OR: [{ code: f }, { name: f }] } }) },
  { key: "reference", label: "Номер платежа", where: (f) => ({ OR: [{ reference: f }, { payments: { some: { reference: f } } }] }) },
];
const STATUSES = Object.keys(TOP_UP_STATUS_LABELS) as TopUpRequestStatus[];

type Params = { sort?: string; q?: string; sf?: string; sv?: string; sm?: string; status?: string; client?: string };

export default async function TopUpsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");
  const search = readListSearch(params);
  const status = STATUSES.find((s) => s === params.status) ?? null;
  const where: Prisma.TopUpRequestWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(params.client ? { customer: { code: params.client } } : {}),
    AND: searchConditions(search, SEARCH_FIELDS),
  };
  const [requests, pending, clients] = await Promise.all([
    prisma.topUpRequest.findMany({
      where,
      include: { customer: { select: { code: true, name: true } }, payments: { where: { deletedAt: null }, select: { number: true } } },
      orderBy: orderBy(sortField, sortDir),
      take: 300,
    }),
    prisma.topUpRequest.aggregate({ where: { deletedAt: null, status: "PENDING" }, _count: true, _sum: { amount: true } }),
    prisma.customer.findMany({ where: { deletedAt: null, code: { not: null }, topUpRequests: { some: {} } }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  const keep = { ...searchParamsOf(search), status: params.status, client: params.client };
  const header = (field: SortField, label: string) => {
    const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return <SortableHeader label={label} href={buildListHref("/top-ups", keep, { sort: `${field}_${nextDir}` })} active={sortField === field} direction={sortDir} />;
  };

  return (
    <>
      <Form
        formKey="top-ups"
        title="Заявки на пополнение"
        search={{ fields: clientFields(SEARCH_FIELDS) }}
        header={
          <ListFilters
            filters={[
              { kind: "select", name: "status", label: "Статус", options: STATUSES.map((s) => ({ value: s, label: TOP_UP_STATUS_LABELS[s] })) },
              { kind: "select", name: "client", label: "Клиент", options: clients.map((c) => ({ value: c.code!, label: `${c.code} — ${c.name}` })) },
            ]}
          />
        }
        footer={<>Ждут проверки: {pending._count} на {yuan(Number(pending._sum.amount ?? 0))} · зачисляет администратор в карточке заявки</>}
      >
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{header("createdAt", "Дата")}</th>
                  <th>{header("number", "Номер")}</th>
                  <th>{header("customerCode", "Клиент")}</th>
                  <th className="num">{header("amount", "Сумма")}</th>
                  <th>Способ</th>
                  <th>Номер платежа</th>
                  <th>{header("status", "Статус")}</th>
                  <th>Приход ДС</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <ClickableRow key={r.id} href={`/top-ups/${r.id}`}>
                    <td className="muted">{formatDateTime(r.createdAt)}</td>
                    <td className="mono strong"><Link href={`/top-ups/${r.id}`}>{r.number}</Link></td>
                    <td><span className="code-pill">{r.customer.code ?? "—"}</span> {r.customer.name}</td>
                    <td className="num">{yuan(r.amount)}</td>
                    <td className="muted">{r.method ?? "—"}</td>
                    <td className="mono">{r.reference ?? "—"}</td>
                    <td><span className={`st st--${TOP_UP_STATUS_COLOR[r.status]}`}>{TOP_UP_STATUS_LABELS[r.status]}</span></td>
                    <td className="mono">{r.payments.map((p) => p.number).join(", ") || "—"}</td>
                  </ClickableRow>
                ))}
                {requests.length === 0 && <tr><td colSpan={8} className="table-empty">Заявок нет — клиенты присылают их со страницы «Баланс» в кабинете</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Form>
      <style>{PURCHASE_ADMIN_CSS}</style>
    </>
  );
}
