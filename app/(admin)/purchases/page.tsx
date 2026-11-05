import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, PurchaseMode, PurchaseStatus } from "@prisma/client";
import { Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { PURCHASE_MODE_LABELS, PURCHASE_STATUS_COLOR, PURCHASE_STATUS_LABELS, purchaseStatusLabel } from "@/lib/statuses";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";
import { clientFields, readListSearch, searchConditions, searchParamsOf, type ServerSearchField } from "@/lib/list-search";
import { yuan } from "@/lib/purchase-money";
import { syncPurchases } from "@/lib/purchases";
import Form from "@/components/form/form";
import ListFilters from "@/components/form/list-filters";
import ClickableRow from "@/components/ui/clickable-row";
import SortableHeader from "@/components/ui/sortable-header";
import { PURCHASE_ADMIN_CSS } from "@/components/purchases/admin-styles";

export const metadata: Metadata = { title: "Покупки" };

// Журнал «Покупки» (docs/product/задание-выкуп.md, раздел 8): заявки клиентов купить в Китае и доставить под ключ.
// Строка открывает карточку покупки — там строки корзины и кнопки по статусу.

const SORT_FIELDS = ["createdAt", "number", "customerCode", "mode", "lines", "total", "status", "country"] as const;
type SortField = (typeof SORT_FIELDS)[number];

function orderBy(field: SortField, dir: SortDirection): Prisma.PurchaseOrderByWithRelationInput {
  switch (field) {
    case "number":
      return { number: dir };
    case "customerCode":
      return { customer: { code: dir } };
    case "mode":
      return { mode: dir };
    case "lines":
      return { lines: { _count: dir } };
    case "total":
      return { totalCny: { sort: dir, nulls: "last" } };
    case "status":
      return { status: dir };
    case "country":
      return { countryCode: { sort: dir, nulls: "last" } };
    default:
      return { createdAt: dir };
  }
}

const SEARCH_FIELDS: ServerSearchField<Prisma.PurchaseWhereInput>[] = [
  { key: "number", label: "Номер", where: (f) => ({ number: f }) },
  { key: "client", label: "Клиент", where: (f) => ({ customer: { OR: [{ code: f }, { name: f }] } }) },
  { key: "product", label: "Товар", where: (f) => ({ lines: { some: { OR: [{ productName: f }, { variant: f }] } } }) },
  { key: "url", label: "Ссылка или продавец", where: (f) => ({ lines: { some: { OR: [{ url: f }, { sellerContact: f }, { seller: f }] } } }) },
  { key: "track", label: "Трек продавца", where: (f) => ({ lines: { some: { sellerTrack: f } } }) },
  { key: "order", label: "Заказ", where: (f) => ({ lines: { some: { order: { number: f } } } }) },
];
const LIMIT = 300;
const STATUSES = Object.keys(PURCHASE_STATUS_LABELS) as PurchaseStatus[];
const MODES = Object.keys(PURCHASE_MODE_LABELS) as PurchaseMode[];

function day(value: string | undefined, plusDays = 0): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + plusDays);
  return date;
}

type Params = {
  sort?: string; q?: string; sf?: string; sv?: string; sm?: string;
  status?: string; mode?: string; client?: string; from?: string; to?: string; deleted?: string;
};

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  await syncPurchases();
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");
  const search = readListSearch(params);
  const status = STATUSES.find((s) => s === params.status) ?? null;
  const mode = MODES.find((m) => m === params.mode) ?? null;
  const from = day(params.from);
  const to = day(params.to, 1);
  const showDeleted = params.deleted === "1";

  const where: Prisma.PurchaseWhereInput = {
    ...(showDeleted ? {} : { deletedAt: null }),
    ...(status ? { status } : {}),
    ...(mode ? { mode } : {}),
    ...(params.client ? { customer: { code: params.client } } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    AND: searchConditions(search, SEARCH_FIELDS),
  };

  const [purchases, total, waiting, clients] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: {
        customer: { select: { code: true, name: true } },
        lines: { select: { productName: true, status: true }, orderBy: { lineNo: "asc" } },
      },
      orderBy: orderBy(sortField, sortDir),
      take: LIMIT,
    }),
    prisma.purchase.count({ where }),
    prisma.purchase.groupBy({ by: ["status"], where: { deletedAt: null, status: { in: ["NEW", "PAID", "PURCHASED"] } }, _count: true }),
    prisma.customer.findMany({ where: { deletedAt: null, code: { not: null }, purchases: { some: {} } }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const countries = await prisma.country.findMany({
    where: { code: { in: [...new Set(purchases.map((p) => p.countryCode).filter((c): c is string => Boolean(c)))] } },
    select: { code: true, nameRu: true },
  });
  const countryName = new Map(countries.map((c) => [c.code, c.nameRu]));
  const count = (s: PurchaseStatus) => waiting.find((w) => w.status === s)?._count ?? 0;

  const keep = {
    ...searchParamsOf(search),
    status: params.status, mode: params.mode, client: params.client, from: params.from, to: params.to, deleted: params.deleted,
  };
  const header = (field: SortField, label: string) => {
    const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return <SortableHeader label={label} href={buildListHref("/purchases", keep, { sort: `${field}_${nextDir}` })} active={sortField === field} direction={sortDir} />;
  };

  return (
    <>
      <Form
        formKey="purchases"
        title="Покупки"
        search={{ fields: clientFields(SEARCH_FIELDS) }}
        commands={
          <Link href="/purchases/settings" className="cmd" data-command="purchase-settings" data-label="Настройки покупки">
            <Settings size={15} aria-hidden="true" />
            Настройки покупки
          </Link>
        }
        header={
          <ListFilters
            filters={[
              { kind: "select", name: "status", label: "Статус", options: STATUSES.map((s) => ({ value: s, label: purchaseStatusLabel(s) })) },
              { kind: "select", name: "mode", label: "Режим", options: MODES.map((m) => ({ value: m, label: PURCHASE_MODE_LABELS[m] })) },
              { kind: "select", name: "client", label: "Клиент", options: clients.map((c) => ({ value: c.code!, label: `${c.code} — ${c.name}` })) },
              { kind: "period", from: "from", to: "to", label: "Период" },
              { kind: "check", name: "deleted", label: "Показать удалённые" },
            ]}
          />
        }
        footer={
          <>
            {total > purchases.length ? `Показаны ${purchases.length} из ${total} — уточните поиск или отбор` : `${total} покупок`} · ждут цену: {count("NEW")} · покупаются:{" "}
            {count("PAID")} · ждут треки: {count("PURCHASED")}
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
                  <th>{header("mode", "Режим")}</th>
                  <th className="num">{header("lines", "Строк")}</th>
                  <th>Товары</th>
                  <th className="num">{header("total", "Итого")}</th>
                  <th>{header("status", "Статус")}</th>
                  <th>{header("country", "Страна")}</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const names = p.lines.filter((l) => l.status !== "REJECTED").map((l) => l.productName);
                  return (
                    <ClickableRow key={p.id} href={`/purchases/${p.id}`} doc={{ entity: "purchase", id: p.id }} className={p.deletedAt ? "is-deleted" : undefined}>
                      <td className="muted">{formatDateTime(p.createdAt)}</td>
                      <td className="mono strong"><Link href={`/purchases/${p.id}`}>{p.number}</Link></td>
                      <td><span className="code-pill">{p.customer.code ?? "—"}</span> {p.customer.name}</td>
                      <td className="muted">{PURCHASE_MODE_LABELS[p.mode]}</td>
                      <td className="num">{p.lines.length}</td>
                      <td className="clip" title={names.join(", ")}>{names.join(", ") || "—"}</td>
                      <td className="num">{p.totalCny != null ? yuan(p.totalCny) : "—"}</td>
                      <td><span className={`st st--${PURCHASE_STATUS_COLOR[p.status]}`}>{purchaseStatusLabel(p.status)}</span></td>
                      <td className="muted">{p.countryCode ? `${p.countryCode} — ${countryName.get(p.countryCode) ?? ""}` : "—"}</td>
                    </ClickableRow>
                  );
                })}
                {purchases.length === 0 && (
                  <tr><td colSpan={9} className="table-empty">Покупок нет — заявки приходят из кабинета клиента («Хочу купить»)</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Form>
      <style>{PURCHASE_ADMIN_CSS}</style>
    </>
  );
}
