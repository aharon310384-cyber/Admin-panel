import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatUsd, formatNumber, formatDateTime } from "@/lib/utils";
import { orderStatusLabel, deliveryTypeLabel, ORDER_STATUS_COLOR } from "@/lib/statuses";
import ClickableRow from "@/components/ui/clickable-row";
import SortableHeader from "@/components/ui/sortable-header";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";

export const metadata: Metadata = { title: "Заказы" };

function dash(v: string | null | undefined): string {
  return v?.trim() || "—";
}

const SORT_FIELDS = [
  "customerCode",
  "productNameText",
  "trackNumber",
  "quantity",
  "unitPriceUsd",
  "declaredValueUsd",
  "actualWeightKg",
  "deliveryType",
  "recipientName",
  "status",
  "createdAt",
] as const;
type SortField = (typeof SORT_FIELDS)[number];

function orderOrderBy(field: SortField, dir: SortDirection): Prisma.OrderOrderByWithRelationInput {
  switch (field) {
    case "customerCode":
      return { customer: { code: dir } };
    case "recipientName":
      return { recipient: { name: dir } };
    case "productNameText":
      return { productNameText: dir };
    case "trackNumber":
      return { trackNumber: dir };
    case "quantity":
      return { quantity: dir };
    case "unitPriceUsd":
      return { unitPriceUsd: dir };
    case "declaredValueUsd":
      return { declaredValueUsd: dir };
    case "actualWeightKg":
      return { actualWeightKg: dir };
    case "deliveryType":
      return { deliveryType: dir };
    case "status":
      return { status: dir };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");

  const orders = await prisma.order.findMany({
    where: { deletedAt: null },
    include: { customer: true, recipient: true },
    orderBy: orderOrderBy(sortField, sortDir),
    take: 200,
  });

  const sortHref = (field: SortField) => {
    const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return buildListHref("/orders", {}, { sort: `${field}_${nextDir}` });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Заказы</h1>
          <p className="page-subtitle">{orders.length} заказов (1 товар + 1 трек)</p>
        </div>
        <Link href="/orders/new" className="btn-add">
          <Plus size={16} />
          Добавить заказ
        </Link>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th><SortableHeader label="Клиент" href={sortHref("customerCode")} active={sortField === "customerCode"} direction={sortDir} /></th>
                <th><SortableHeader label="Наименование" href={sortHref("productNameText")} active={sortField === "productNameText"} direction={sortDir} /></th>
                <th><SortableHeader label="Трек-номер" href={sortHref("trackNumber")} active={sortField === "trackNumber"} direction={sortDir} /></th>
                <th><SortableHeader label="Кол-во" href={sortHref("quantity")} active={sortField === "quantity"} direction={sortDir} /></th>
                <th><SortableHeader label="Цена $" href={sortHref("unitPriceUsd")} active={sortField === "unitPriceUsd"} direction={sortDir} /></th>
                <th><SortableHeader label="Объявл. $" href={sortHref("declaredValueUsd")} active={sortField === "declaredValueUsd"} direction={sortDir} /></th>
                <th><SortableHeader label="Вес кг" href={sortHref("actualWeightKg")} active={sortField === "actualWeightKg"} direction={sortDir} /></th>
                <th><SortableHeader label="Доставка" href={sortHref("deliveryType")} active={sortField === "deliveryType"} direction={sortDir} /></th>
                <th><SortableHeader label="Получатель" href={sortHref("recipientName")} active={sortField === "recipientName"} direction={sortDir} /></th>
                <th><SortableHeader label="Статус" href={sortHref("status")} active={sortField === "status"} direction={sortDir} /></th>
                <th><SortableHeader label="Создан" href={sortHref("createdAt")} active={sortField === "createdAt"} direction={sortDir} /></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <ClickableRow key={o.id} href={`/orders/${o.id}/edit`}>
                  <td>
                    <span className="code-pill">{dash(o.customer.code)}</span>
                  </td>
                  <td className="strong">{dash(o.productNameText)}</td>
                  <td className="mono text-muted">{dash(o.trackNumber)}</td>
                  <td className="tabular">{o.quantity}</td>
                  <td className="tabular">{o.unitPriceUsd ? formatUsd(o.unitPriceUsd) : "—"}</td>
                  <td className="tabular text-muted">{o.declaredValueUsd ? formatUsd(o.declaredValueUsd) : "—"}</td>
                  <td className="tabular">{o.actualWeightKg ? formatNumber(Number(o.actualWeightKg)) : "—"}</td>
                  <td className="text-muted">{deliveryTypeLabel(o.deliveryType)}</td>
                  <td className="text-muted">{dash(o.recipient?.name)}</td>
                  <td>
                    <span className={`st st--${ORDER_STATUS_COLOR[o.status]}`}>{orderStatusLabel(o.status)}</span>
                  </td>
                  <td className="text-muted">{formatDateTime(o.createdAt)}</td>
                </ClickableRow>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-empty">Заказов пока нет</td>
                </tr>
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
        .btn-add { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; background: var(--color-accent); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: #fff; text-decoration: none; white-space: nowrap; transition: opacity 0.15s; }
        .btn-add:hover { opacity: 0.9; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { min-width: 1200px; width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: middle; white-space: nowrap; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .strong { font-weight: 600; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }
        .code-pill { display: inline-flex; align-items: center; min-width: 36px; justify-content: center; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }

        .st { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
        .st--new { color: var(--color-status-new); background: var(--color-status-new-bg); }
        .st--processing { color: var(--color-status-processing); background: var(--color-status-processing-bg); }
        .st--shipped { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
        .st--completed { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .st--canceled { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }
      `}</style>
    </div>
  );
}
