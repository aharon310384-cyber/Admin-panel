"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send } from "lucide-react";
import type { DeliveryType, OrderStatus } from "@prisma/client";
import SortableHeader from "@/components/ui/sortable-header";
import { formatUsd, formatNumber } from "@/lib/utils";
import { orderStatusLabel, deliveryTypeLabel, ORDER_STATUS_COLOR } from "@/lib/statuses";

export type OrderRow = {
  id: string;
  customerId: string;
  customerCode: string | null;
  recipientId: string | null;
  recipientName: string | null;
  productNameText: string | null;
  trackNumber: string | null;
  customerComment: string | null;
  quantity: number;
  unitPriceUsd: number | null;
  declaredValueUsd: number | null;
  actualWeightKg: number | null;
  deliveryType: DeliveryType | null;
  status: OrderStatus;
  parcelId: string | null;
  createdAtLabel: string;
};

type SortField = string;
type SortDir = "asc" | "desc";

const dash = (v: string | null | undefined) => v?.trim() || "—";

/** Ключ группировки: одна посылка = один клиент + получатель + вид доставки. */
const groupKeyOf = (o: OrderRow) =>
  `${o.customerId}|${o.recipientId ?? ""}|${o.deliveryType ?? ""}`;

export default function OrdersSelectTable({
  orders,
  sortHrefs,
  sortField,
  sortDir,
}: {
  orders: OrderRow[];
  sortHrefs: Record<string, string>;
  sortField: SortField;
  sortDir: SortDir;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Активная группа = группа первого выбранного заказа: пока она задана,
  // выбирать можно только заказы из той же группы (иначе посылка склеит
  // разных клиентов/получателей).
  const activeGroupKey = useMemo(() => {
    if (selected.size === 0) return null;
    const firstId = selected.values().next().value as string;
    const order = orders.find((o) => o.id === firstId);
    return order ? groupKeyOf(order) : null;
  }, [selected, orders]);

  const isSelectable = (o: OrderRow) => {
    if (o.status !== "RECEIVED" || o.parcelId) return false;
    if (!o.deliveryType) return false;
    if (!activeGroupKey) return true;
    return groupKeyOf(o) === activeGroupKey;
  };

  const reasonWhyNot = (o: OrderRow) =>
    o.parcelId
      ? "Уже в посылке"
      : o.status !== "RECEIVED"
        ? "Не «Принят на склад»"
        : !o.deliveryType
          ? "Не указан вид доставки"
          : "Другой клиент, получатель или вид доставки";

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const clear = () => setSelected(new Set());

  const count = selected.size;
  const proceedHref =
    count > 0 ? `/parcels/from-orders?orderIds=${Array.from(selected).join(",")}` : "#";

  return (
    <>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="cell-narrow" aria-label="Выбор" />
                <th><SortableHeader label="Клиент" href={sortHrefs.customerCode} active={sortField === "customerCode"} direction={sortDir} /></th>
                <th><SortableHeader label="Наименование" href={sortHrefs.productNameText} active={sortField === "productNameText"} direction={sortDir} /></th>
                <th><SortableHeader label="Трек-номер" href={sortHrefs.trackNumber} active={sortField === "trackNumber"} direction={sortDir} /></th>
                <th>Комментарий</th>
                <th><SortableHeader label="Кол-во" href={sortHrefs.quantity} active={sortField === "quantity"} direction={sortDir} /></th>
                <th><SortableHeader label="Цена $" href={sortHrefs.unitPriceUsd} active={sortField === "unitPriceUsd"} direction={sortDir} /></th>
                <th><SortableHeader label="Объявл. $" href={sortHrefs.declaredValueUsd} active={sortField === "declaredValueUsd"} direction={sortDir} /></th>
                <th><SortableHeader label="Вес кг" href={sortHrefs.actualWeightKg} active={sortField === "actualWeightKg"} direction={sortDir} /></th>
                <th><SortableHeader label="Доставка" href={sortHrefs.deliveryType} active={sortField === "deliveryType"} direction={sortDir} /></th>
                <th><SortableHeader label="Получатель" href={sortHrefs.recipientName} active={sortField === "recipientName"} direction={sortDir} /></th>
                <th><SortableHeader label="Статус" href={sortHrefs.status} active={sortField === "status"} direction={sortDir} /></th>
                <th><SortableHeader label="Создан" href={sortHrefs.createdAt} active={sortField === "createdAt"} direction={sortDir} /></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const checked = selected.has(o.id);
                const selectable = isSelectable(o);
                const disabled = !checked && !selectable;
                return (
                  <tr
                    key={o.id}
                    className={`row-clickable ${disabled ? "row-dim" : ""}`}
                    onClick={(e) => {
                      const t = e.target as HTMLElement;
                      if (t.closest("input,button,a,label")) return;
                      router.push(`/orders/${o.id}/edit`);
                    }}
                  >
                    <td className="cell-narrow">
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(o.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Выбрать заказ"
                        title={disabled ? reasonWhyNot(o) : undefined}
                      />
                    </td>
                    <td><span className="code-pill">{dash(o.customerCode)}</span></td>
                    <td className="strong">{dash(o.productNameText)}</td>
                    <td className="mono text-muted">{dash(o.trackNumber)}</td>
                    <td className="text-muted comment" title={o.customerComment ?? undefined}>{dash(o.customerComment)}</td>
                    <td className="tabular">{o.quantity}</td>
                    <td className="tabular">{o.unitPriceUsd != null ? formatUsd(o.unitPriceUsd) : "—"}</td>
                    <td className="tabular text-muted">{o.declaredValueUsd != null ? formatUsd(o.declaredValueUsd) : "—"}</td>
                    <td className="tabular">{o.actualWeightKg != null ? formatNumber(o.actualWeightKg) : "—"}</td>
                    <td className="text-muted">{deliveryTypeLabel(o.deliveryType)}</td>
                    <td className="text-muted">{dash(o.recipientName)}</td>
                    <td><span className={`st st--${ORDER_STATUS_COLOR[o.status]}`}>{orderStatusLabel(o.status)}</span></td>
                    <td className="text-muted">{o.createdAtLabel}</td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={13} className="table-empty">Заказов пока нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {count > 0 && (
        <div className="sticky-bar" role="region" aria-label="Оформление на отправку">
          <span className="sticky-info"><strong>Выбрано: {count}</strong></span>
          <div className="sticky-actions">
            <button type="button" className="btn-secondary" onClick={clear}>Снять выбор</button>
            <Link href={proceedHref} className="btn-primary">
              <Send size={15} />
              Оформить на отправку
            </Link>
          </div>
        </div>
      )}

      <style>{`
        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { min-width: 1280px; width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: middle; white-space: nowrap; }
        .table tbody tr:last-child td { border-bottom: none; }
        .row-clickable { cursor: pointer; }
        .table tbody tr.row-clickable:hover td { background: var(--color-muted-bg); }
        .row-dim td { opacity: 0.55; }
        .row-dim.row-clickable:hover td { background: transparent; }
        .cell-narrow { width: 1%; white-space: nowrap; }
        .row-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-accent); }
        .row-checkbox:disabled { cursor: not-allowed; opacity: 0.4; }
        .strong { font-weight: 600; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }
        .comment { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .code-pill { display: inline-flex; align-items: center; min-width: 36px; justify-content: center; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }

        .st { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
        .st--new { color: var(--color-status-new); background: var(--color-status-new-bg); }
        .st--processing { color: var(--color-status-processing); background: var(--color-status-processing-bg); }
        .st--shipped { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
        .st--completed { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .st--canceled { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }

        .sticky-bar { position: sticky; bottom: 16px; margin-top: 16px; padding: 12px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: 0 8px 24px oklch(20% 0.02 60 / 0.18); display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; backdrop-filter: blur(16px) saturate(1.4); z-index: 10; }
        .sticky-info { font-size: 13.5px; color: var(--color-text); }
        .sticky-actions { display: flex; align-items: center; gap: 10px; }
        .btn-secondary { display: inline-flex; align-items: center; padding: 8px 14px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-text); cursor: pointer; transition: background 0.15s; }
        .btn-secondary:hover { background: var(--color-muted-bg); }
        .btn-primary { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; background: var(--color-accent); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: #fff; text-decoration: none; transition: opacity 0.15s; }
        .btn-primary:hover { opacity: 0.9; }
      `}</style>
    </>
  );
}
