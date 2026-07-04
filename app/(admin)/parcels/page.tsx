import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatUsd, formatNumber, formatDateTime } from "@/lib/utils";
import { parcelStatusLabel, deliveryTypeLabel } from "@/lib/statuses";
import SortableHeader from "@/components/ui/sortable-header";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";

export const metadata: Metadata = { title: "Посылки" };

const SORT_FIELDS = [
  "customerCode",
  "number",
  "status",
  "recipientName",
  "deliveryType",
  "ordersCount",
  "billableWeightKg",
  "totalUsd",
  "isPaid",
  "createdAt",
] as const;
type SortField = (typeof SORT_FIELDS)[number];

function parcelOrderBy(field: SortField, dir: SortDirection): Prisma.ParcelOrderByWithRelationInput {
  switch (field) {
    case "customerCode":
      return { customer: { code: dir } };
    case "recipientName":
      return { recipient: { name: dir } };
    case "ordersCount":
      return { orders: { _count: dir } };
    case "number":
      return { number: dir };
    case "status":
      return { status: dir };
    case "deliveryType":
      return { deliveryType: dir };
    case "billableWeightKg":
      return { billableWeightKg: dir };
    case "totalUsd":
      return { totalUsd: dir };
    case "isPaid":
      return { isPaid: dir };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

export default async function ParcelsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");

  const parcels = await prisma.parcel.findMany({
    where: { deletedAt: null },
    include: { customer: { select: { name: true, code: true } }, recipient: { select: { name: true } }, _count: { select: { orders: true } } },
    orderBy: parcelOrderBy(sortField, sortDir),
    take: 200,
  });

  const sortHref = (field: SortField) => {
    const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return buildListHref("/parcels", {}, { sort: `${field}_${nextDir}` });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Посылки</h1>
          <p className="page-subtitle">{parcels.length} посылок</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th><SortableHeader label="Клиент" href={sortHref("customerCode")} active={sortField === "customerCode"} direction={sortDir} /></th>
                <th><SortableHeader label="Номер" href={sortHref("number")} active={sortField === "number"} direction={sortDir} /></th>
                <th><SortableHeader label="Статус" href={sortHref("status")} active={sortField === "status"} direction={sortDir} /></th>
                <th><SortableHeader label="Получатель" href={sortHref("recipientName")} active={sortField === "recipientName"} direction={sortDir} /></th>
                <th><SortableHeader label="Доставка" href={sortHref("deliveryType")} active={sortField === "deliveryType"} direction={sortDir} /></th>
                <th><SortableHeader label="Заказов" href={sortHref("ordersCount")} active={sortField === "ordersCount"} direction={sortDir} /></th>
                <th><SortableHeader label="Вес кг" href={sortHref("billableWeightKg")} active={sortField === "billableWeightKg"} direction={sortDir} /></th>
                <th><SortableHeader label="Итог $" href={sortHref("totalUsd")} active={sortField === "totalUsd"} direction={sortDir} /></th>
                <th><SortableHeader label="Оплата" href={sortHref("isPaid")} active={sortField === "isPaid"} direction={sortDir} /></th>
                <th><SortableHeader label="Создана" href={sortHref("createdAt")} active={sortField === "createdAt"} direction={sortDir} /></th>
              </tr>
            </thead>
            <tbody>
              {parcels.map((p) => (
                <tr key={p.id}>
                  <td><span className="code-pill">{p.customer.code ?? "—"}</span></td>
                  <td><Link href={`/parcels/${p.id}`} className="num">{p.number}</Link></td>
                  <td><span className="st">{parcelStatusLabel(p.status)}</span></td>
                  <td className="text-muted">{p.recipient?.name ?? "—"}</td>
                  <td className="text-muted">{deliveryTypeLabel(p.deliveryType)}</td>
                  <td className="tabular">{p._count.orders}</td>
                  <td className="tabular">{formatNumber(Number(p.billableWeightKg ?? 0))}</td>
                  <td className="tabular strong">{formatUsd(Number(p.totalUsd))}</td>
                  <td>{p.isPaid ? <span className="paid">Оплачено</span> : <span className="text-muted">—</span>}</td>
                  <td className="text-muted">{formatDateTime(p.createdAt)}</td>
                </tr>
              ))}
              {parcels.length === 0 && (
                <tr><td colSpan={10} className="table-empty">Посылок пока нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }
        .btn-add { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; background: var(--color-accent); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: #fff; text-decoration: none; white-space: nowrap; }
        .btn-add:hover { opacity: 0.9; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { min-width: 1000px; width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); white-space: nowrap; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .num { font-family: var(--font-mono); font-weight: 600; color: var(--color-accent); text-decoration: none; }
        .st { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; color: var(--color-accent); background: oklch(52% 0.14 42 / 0.08); }
        .strong { font-weight: 700; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }
        .paid { color: var(--color-status-completed); font-weight: 600; }
        .code-pill { display: inline-flex; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
      `}</style>
    </div>
  );
}
