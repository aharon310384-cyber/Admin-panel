"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import type { ParcelStatus } from "@prisma/client";
import SortableHeader from "@/components/ui/sortable-header";
import { ParcelStatusBadge, ProductStatusBadge } from "@/components/ui/status-badge";
import { formatUsd } from "@/lib/utils";

export type OrderRow = {
  id: string;
  sku: string;
  name: string;
  comments: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  imageUrl: string | null;
  deliveryType: string | null;
  customer: { id: string; name: string; code: string | null } | null;
  parcel: { id: string; number: string; status: ParcelStatus } | null;
};

type SortField = "name" | "sku" | "price" | "stock" | "isActive";
type SortDir = "asc" | "desc";

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const GROUP_COLORS = [
  "oklch(58% 0.16 250)",
  "oklch(62% 0.16 150)",
  "oklch(70% 0.16 70)",
  "oklch(60% 0.18 25)",
  "oklch(58% 0.18 300)",
  "oklch(62% 0.14 200)",
  "oklch(64% 0.18 340)",
  "oklch(60% 0.14 180)",
];

const groupKeyOf = (o: OrderRow) =>
  `${o.customer?.id ?? ""}|${o.deliveryType ?? ""}`;

export default function OrdersTable({
  orders,
  sortHrefs,
  sortField,
  sortDir,
  isAdmin,
  showParcelColumn = false,
}: {
  orders: OrderRow[];
  sortHrefs: Record<SortField, string>;
  sortField: string;
  sortDir: SortDir;
  isAdmin: boolean;
  showParcelColumn?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { letter: string; color: string; label: string }
    >();
    let idx = 0;
    for (const o of orders) {
      const key = groupKeyOf(o);
      if (map.has(key)) continue;
      map.set(key, {
        letter: GROUP_LETTERS[idx % GROUP_LETTERS.length],
        color: GROUP_COLORS[idx % GROUP_COLORS.length],
        label: `${o.customer?.name ?? "Без получателя"} · ${
          o.deliveryType || "без типа доставки"
        }`,
      });
      idx++;
    }
    return map;
  }, [orders]);

  const activeGroupKey = useMemo(() => {
    if (selected.size === 0) return null;
    const firstId = selected.values().next().value as string;
    const order = orders.find((o) => o.id === firstId);
    return order ? groupKeyOf(order) : null;
  }, [selected, orders]);

  const isRowSelectable = (o: OrderRow) => {
    if (o.parcel) return false;
    if (!o.customer?.id || !o.deliveryType) return false;
    if (!o.isActive) return false;
    if (!activeGroupKey) return true;
    return groupKeyOf(o) === activeGroupKey;
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const selectedCount = selected.size;
  const activeGroup = activeGroupKey ? groups.get(activeGroupKey) : null;

  const proceedHref =
    selectedCount > 0
      ? `/parcels/from-orders?orderIds=${Array.from(selected).join(",")}`
      : "#";

  return (
    <>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="cell-narrow" aria-label="Выбор" />
                <th className="cell-narrow">Группа</th>
                <th>
                  <SortableHeader
                    label="Трек номер"
                    href={sortHrefs.name}
                    active={sortField === "name"}
                    direction={sortDir}
                  />
                </th>
                <th>Получатель / доставка</th>
                <th>Комментарии</th>
                <th>
                  <SortableHeader
                    label="Итого стоимость $"
                    href={sortHrefs.price}
                    active={sortField === "price"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Количество"
                    href={sortHrefs.stock}
                    active={sortField === "stock"}
                    direction={sortDir}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Статус"
                    href={sortHrefs.isActive}
                    active={sortField === "isActive"}
                    direction={sortDir}
                  />
                </th>
                {showParcelColumn && <th>Посылка</th>}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const g = groups.get(groupKeyOf(o));
                const checked = selected.has(o.id);
                const selectable = isRowSelectable(o);
                const disabled = !checked && !selectable;
                const missing = o.parcel
                  ? "Уже в посылке"
                  : !o.customer?.id
                    ? "Не указан получатель"
                    : !o.deliveryType
                      ? "Не указан тип доставки"
                      : !o.isActive
                        ? "Заказ в архиве"
                        : "Другой получатель или тип доставки";
                return (
                  <tr
                    key={o.id}
                    className={`row-clickable ${disabled ? "row-disabled" : ""}`}
                    onClick={(event) => {
                      if (!isAdmin) return;
                      const target = event.target as HTMLElement;
                      if (target.closest("input,button,a,label")) return;
                      router.push(`/orders/${o.id}/edit`);
                    }}
                  >
                    <td className="cell-narrow">
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleRow(o.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Выбрать ${o.sku}`}
                        title={disabled ? missing : undefined}
                      />
                    </td>
                    <td className="cell-narrow">
                      {g ? (
                        <span
                          className="group-badge"
                          style={{ background: g.color }}
                          title={g.label}
                        >
                          {g.letter}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className="product-name">{o.name}</span>
                    </td>
                    <td className="recipient-cell">
                      <div className="recipient-name">
                        {o.customer?.name ?? (
                          <span className="text-muted">—</span>
                        )}
                      </div>
                      <div className="recipient-sub">
                        {o.deliveryType || "тип доставки не указан"}
                      </div>
                    </td>
                    <td className="comments-cell">
                      {o.comments ? o.comments : "—"}
                    </td>
                    <td className="tabular">{formatUsd(o.price)}</td>
                    <td
                      className={`tabular ${o.stock === 0 ? "text-danger" : ""}`}
                    >
                      {o.stock} шт.
                    </td>
                    <td>
                      <ProductStatusBadge active={o.isActive} />
                    </td>
                    {showParcelColumn && (
                      <td>
                        {o.parcel ? (
                          <div className="parcel-cell">
                            <Link
                              href={`/parcels/${o.parcel.id}`}
                              className="link mono"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {o.parcel.number}
                            </Link>
                            <ParcelStatusBadge status={o.parcel.status} />
                          </div>
                        ) : (
                          <span className="text-muted">не оформлен</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={showParcelColumn ? 9 : 8} className="table-empty">
                    Заказов не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="sticky-bar" role="region" aria-label="Оформление на отправку">
          <div className="sticky-info">
            <strong>Выбрано: {selectedCount}</strong>
            {activeGroup && (
              <span className="sticky-group">
                <span
                  className="group-badge group-badge--inline"
                  style={{ background: activeGroup.color }}
                >
                  {activeGroup.letter}
                </span>
                {activeGroup.label}
              </span>
            )}
          </div>
          <div className="sticky-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={clearSelection}
            >
              Снять выбор
            </button>
            <Link href={proceedHref} className="btn-primary">
              <Send size={15} />
              Оформить на отправку
            </Link>
          </div>
        </div>
      )}

      <style>{`
        .cell-narrow { width: 1%; white-space: nowrap; }
        .row-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-accent); }
        .row-checkbox:disabled { cursor: not-allowed; opacity: 0.4; }
        .row-clickable { cursor: pointer; }
        .row-clickable:hover td { background: var(--color-muted-bg); }
        .row-disabled td { opacity: 0.5; }
        .row-disabled.row-clickable { cursor: default; }
        .row-disabled.row-clickable:hover td { background: transparent; }
        .row-disabled td .product-name,
        .row-disabled td .recipient-name,
        .row-disabled td .order-number { color: var(--color-muted); }

        .group-badge { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #fff; font-family: var(--font-mono); }
        .group-badge--inline { width: 22px; height: 22px; font-size: 11px; margin-right: 6px; }

        .recipient-cell { line-height: 1.35; }
        .recipient-name { font-weight: 500; color: var(--color-text); }
        .recipient-sub { font-size: 12px; color: var(--color-muted); }

        .parcel-cell { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .link { color: var(--color-accent); text-decoration: none; }
        .link:hover { text-decoration: underline; }

        .sticky-bar { position: sticky; bottom: 16px; margin-top: 16px; padding: 12px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: 0 8px 24px oklch(20% 0.02 60 / 0.18); display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; backdrop-filter: blur(16px) saturate(1.4); z-index: 10; }
        .sticky-info { display: flex; align-items: center; gap: 12px; font-size: 13.5px; color: var(--color-text); flex-wrap: wrap; }
        .sticky-info strong { font-weight: 700; }
        .sticky-group { display: inline-flex; align-items: center; gap: 0; color: var(--color-muted); }
        .sticky-actions { display: flex; align-items: center; gap: 10px; }

        .btn-secondary { display: inline-flex; align-items: center; padding: 8px 14px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-text); cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; text-decoration: none; }
        .btn-secondary:hover { background: var(--color-muted-bg); }
      `}</style>
    </>
  );
}
