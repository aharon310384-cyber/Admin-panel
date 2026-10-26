import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import ClickableRow from "@/components/ui/clickable-row";
import SortableHeader from "@/components/ui/sortable-header";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";
import Form from "@/components/form/form";
import { clientFields, readListSearch, searchConditions, searchParamsOf, type ServerSearchField } from "@/lib/list-search";

export const metadata: Metadata = { title: "Получатели" };

function dash(v: string | null | undefined): string {
  return v?.trim() || "—";
}

const SORT_FIELDS = ["customerCode", "name", "phone", "country", "city", "postalCode", "createdAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

// Прямое сопоставление колонки → orderBy Prisma. customerCode сортирует по коду клиента (связь).
function recipientOrderBy(field: SortField, dir: SortDirection): Prisma.RecipientOrderByWithRelationInput {
  switch (field) {
    case "customerCode":
      return { customer: { code: dir } };
    case "name":
      return { name: dir };
    case "phone":
      return { phone: dir };
    case "country":
      return { country: dir };
    case "city":
      return { city: dir };
    case "postalCode":
      return { postalCode: dir };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

// Поиск списка (строка поиска и «Расширенный поиск»): подписи — как заголовки столбцов таблицы.
const SEARCH_FIELDS: ServerSearchField<Prisma.RecipientWhereInput>[] = [
  { key: "client", label: "Клиент", where: (f) => ({ customer: { OR: [{ code: f }, { name: f }] } }) },
  { key: "name", label: "Имя", where: (f) => ({ name: f }) },
  { key: "phone", label: "Телефон", where: (f) => ({ phone: f }) },
  { key: "country", label: "Страна", where: (f) => ({ country: f }) },
  { key: "city", label: "Город", where: (f) => ({ city: f }) },
  { key: "address", label: "Адрес", where: (f) => ({ address: f }) },
  { key: "postal", label: "Индекс", where: (f) => ({ postalCode: f }) },
  { key: "passport", label: "Номер паспорта", where: (f) => ({ passportNumber: f }) },
];
const LIMIT = 300;

export default async function RecipientsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string; sf?: string; sv?: string; sm?: string }>;
}) {
  const params = await searchParams;
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");
  const search = readListSearch(params);
  const where: Prisma.RecipientWhereInput = { deletedAt: null, AND: searchConditions(search, SEARCH_FIELDS) };

  const [recipients, total] = await Promise.all([
    prisma.recipient.findMany({
      where,
      include: { customer: { select: { code: true } } },
      orderBy: recipientOrderBy(sortField, sortDir),
      take: LIMIT,
    }),
    prisma.recipient.count({ where }),
  ]);

  // Клик по заголовку переключает направление; текущий столбец — инвертирует, новый — по возрастанию.
  const sortHref = (field: SortField) => {
    const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return buildListHref("/recipients", searchParamsOf(search), { sort: `${field}_${nextDir}` });
  };

  return (
    <>
      <Form
        formKey="recipients"
        title="Получатели"
        commands={
          <Link href="/recipients/new" className="cmd cmd--primary" data-command="create">
            <Plus size={15} />
            Создать
          </Link>
        }
        search={{ fields: clientFields(SEARCH_FIELDS) }}
        footer={
          <>
            {total > recipients.length ? `Показаны ${recipients.length} из ${total} — уточните поиск (Ctrl+F)` : `${total} получателей`} ·
            привязаны к клиентам
          </>
        }
      >
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th><SortableHeader label="Клиент" href={sortHref("customerCode")} active={sortField === "customerCode"} direction={sortDir} /></th>
                  <th><SortableHeader label="Имя" href={sortHref("name")} active={sortField === "name"} direction={sortDir} /></th>
                  <th><SortableHeader label="Телефон" href={sortHref("phone")} active={sortField === "phone"} direction={sortDir} /></th>
                  <th><SortableHeader label="Страна" href={sortHref("country")} active={sortField === "country"} direction={sortDir} /></th>
                  <th><SortableHeader label="Город" href={sortHref("city")} active={sortField === "city"} direction={sortDir} /></th>
                  <th>Адрес</th>
                  <th><SortableHeader label="Индекс" href={sortHref("postalCode")} active={sortField === "postalCode"} direction={sortDir} /></th>
                  <th><SortableHeader label="Создан" href={sortHref("createdAt")} active={sortField === "createdAt"} direction={sortDir} /></th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <ClickableRow key={r.id} href={`/recipients/${r.id}`}>
                    <td><span className="code-pill">{dash(r.customer.code)}</span></td>
                    <td className="strong">{dash(r.name)}</td>
                    <td className="mono text-muted">{dash(r.phone)}</td>
                    <td className="text-muted">{dash(r.country)}</td>
                    <td className="text-muted">{dash(r.city)}</td>
                    <td className="addr">{dash(r.address)}</td>
                    <td className="mono text-muted">{dash(r.postalCode)}</td>
                    <td className="text-muted">{formatDateTime(r.createdAt)}</td>
                  </ClickableRow>
                ))}
                {recipients.length === 0 && (
                  <tr><td colSpan={8} className="table-empty">Получателей пока нет</td></tr>
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
        .table td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .strong { font-weight: 600; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .addr { max-width: 280px; color: var(--color-text); }
        .text-muted { color: var(--color-muted); }
        .code-pill { display: inline-flex; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
      `}</style>
    </>
  );
}
