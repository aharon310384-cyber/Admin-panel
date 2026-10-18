"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ParcelStatus } from "@prisma/client";
import SortableHeader from "@/components/ui/sortable-header";
import { setParcelsStatus } from "@/actions/parcel-form";
import { formatNumber, formatUsd } from "@/lib/utils";
import { PARCEL_STATUS_COLOR, PARCEL_STATUS_LABELS, parcelStatusLabel } from "@/lib/statuses";

// Список посылок: отметки слева — смена статуса сразу нескольким посылкам (ручной инструмент на крайний случай).
// «Отслеживание» — что знает 17TRACK; красным — требует внимания.

export type ParcelRow = {
  id: string;
  createdAtLabel: string;
  trackingNumber: string | null;
  taskNumber: string | null;
  customerCode: string | null;
  status: ParcelStatus;
  recipientName: string | null;
  deliveryLabel: string;
  ordersCount: number;
  weightKg: number;
  totalUsd: number;
  isPaid: boolean;
  tracking: { label: string; tone: "on" | "done" | "problem" | "none"; hint: string | null } | null;
};

const STATUS_OPTIONS = Object.entries(PARCEL_STATUS_LABELS) as [ParcelStatus, string][];

export default function ParcelsTable({
  rows,
  sortHrefs,
  sortField,
  sortDir,
}: {
  rows: ParcelRow[];
  sortHrefs: Record<string, string>;
  sortField: string;
  sortDir: "asc" | "desc";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<ParcelStatus>("DELIVERED");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));

  const apply = () => {
    const ids = [...selected];
    const label = PARCEL_STATUS_LABELS[status];
    if (!confirm(`Поставить статус «${label}» посылкам: ${ids.length}? Клиентам с Telegram придёт сообщение о смене статуса.`)) return;
    startTransition(async () => {
      const r = await setParcelsStatus(ids, status);
      const text = [`Статус «${label}» поставлен: ${r.changed}`, ...r.errors].join(". ");
      setResult({ ok: r.ok, text });
      if (r.ok) setSelected(new Set());
      router.refresh();
    });
  };

  const header = (label: string, field: string) => (
    <th><SortableHeader label={label} href={sortHrefs[field]} active={sortField === field} direction={sortDir} /></th>
  );

  return (
    <>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="cell-narrow" aria-label="Отметка">
                  <input type="checkbox" className="row-checkbox" checked={allChecked} onChange={toggleAll} aria-label="Отметить все" />
                </th>
                {header("Дата", "createdAt")}
                {header("Трек-номер", "trackingNumber")}
                {header("Задача", "taskNumber")}
                {header("Клиент", "customerCode")}
                {header("Статус", "status")}
                <th>Отслеживание</th>
                {header("Получатель", "recipientName")}
                {header("Доставка", "deliveryType")}
                {header("Заказов", "ordersCount")}
                {header("Вес кг", "billableWeightKg")}
                {header("Итог $", "totalUsd")}
                {header("Оплата", "isPaid")}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  data-doc="parcel"
                  data-doc-id={p.id}
                  className="row-clickable"
                  title="Двойной клик — открыть"
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).closest("a, button, input, select, label")) return;
                    router.push(`/parcels/${p.id}`);
                  }}
                >
                  <td className="cell-narrow">
                    <input
                      type="checkbox"
                      className="row-checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Отметить посылку"
                    />
                  </td>
                  <td className="text-muted">{p.createdAtLabel}</td>
                  <td className="track">{p.trackingNumber ?? "—"}</td>
                  <td className="task-num">{p.taskNumber ?? "—"}</td>
                  <td><span className="code-pill">{p.customerCode ?? "—"}</span></td>
                  <td><span className={`st st--${PARCEL_STATUS_COLOR[p.status]}`}>{parcelStatusLabel(p.status)}</span></td>
                  <td title={p.tracking?.hint ?? undefined}>
                    {p.tracking ? <span className={`trk trk--${p.tracking.tone}`}>{p.tracking.label}</span> : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-muted">{p.recipientName ?? "—"}</td>
                  <td className="text-muted">{p.deliveryLabel}</td>
                  <td className="tabular">{p.ordersCount}</td>
                  <td className="tabular">{formatNumber(p.weightKg)}</td>
                  <td className="tabular strong">{formatUsd(p.totalUsd)}</td>
                  <td>{p.isPaid ? <span className="paid">Оплачено</span> : <span className="text-muted">—</span>}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={13} className="table-empty">Посылок нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(selected.size > 0 || result) && (
        <div className="sticky-bar" role="region" aria-label="Статус отмеченным посылкам">
          {selected.size > 0 ? (
            <>
              <span className="sticky-info"><strong>Отмечено: {selected.size}</strong></span>
              <div className="sticky-actions">
                <select className="sticky-select" value={status} onChange={(e) => setStatus(e.target.value as ParcelStatus)} aria-label="Новый статус">
                  {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button type="button" className="btn-primary" onClick={apply} disabled={pending}>Поставить статус</button>
                <button type="button" className="btn-secondary" onClick={() => setSelected(new Set())}>Снять отметки</button>
              </div>
            </>
          ) : null}
          {result && (
            <p className={result.ok ? "sticky-ok" : "sticky-error"} role="status">
              {result.text}
              <button type="button" className="sticky-close" onClick={() => setResult(null)} aria-label="Скрыть">×</button>
            </p>
          )}
        </div>
      )}

      <style>{`
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { min-width: 1100px; width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); white-space: nowrap; }
        .table tbody tr:last-child td { border-bottom: none; }
        .row-clickable { cursor: pointer; }
        .table tbody tr.row-clickable:hover td { background: var(--color-muted-bg); }
        .cell-narrow { width: 1%; }
        .row-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-accent); }
        .track { font-family: var(--font-mono); color: var(--color-text); }
        .task-num { font-family: var(--font-mono); color: var(--color-text-secondary); }
        .st, .trk { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
        .st--new { color: var(--color-status-new); background: var(--color-status-new-bg); }
        .st--assembled { color: var(--color-status-assembled); background: var(--color-status-assembled-bg); }
        .st--processing { color: var(--color-status-processing); background: var(--color-status-processing-bg); }
        .st--ready { color: var(--color-status-ready); background: var(--color-status-ready-bg); }
        .st--shipped { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
        .st--completed { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .st--canceled { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }
        .st--utilized { color: var(--color-status-utilized); background: var(--color-status-utilized-bg); }
        .trk--on { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
        .trk--done { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .trk--problem { color: var(--color-danger); background: var(--color-warning-bg); }
        .trk--none { color: var(--color-muted); background: var(--color-muted-bg); }
        .strong { font-weight: 700; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }
        .paid { color: var(--color-status-completed); font-weight: 600; }
        .code-pill { display: inline-flex; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }

        .sticky-bar { position: sticky; bottom: calc(var(--shell-bottom, 0px) + 36px); z-index: 10; margin-top: 12px; padding: 10px 14px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: 0 8px 24px oklch(20% 0.02 60 / 0.18); display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; }
        .sticky-info { font-size: 13.5px; }
        .sticky-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .sticky-select { height: 32px; padding: 0 8px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); font: inherit; font-size: 13px; background: #fff; }
        .btn-secondary { display: inline-flex; align-items: center; padding: 7px 12px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text); cursor: pointer; }
        .btn-secondary:hover { background: var(--color-muted-bg); }
        .btn-primary { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; background: var(--color-accent); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: #fff; cursor: pointer; }
        .btn-primary:disabled { opacity: 0.6; cursor: wait; }
        .sticky-ok, .sticky-error { flex-basis: 100%; margin: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; font-size: 13px; line-height: 1.45; }
        .sticky-ok { color: var(--color-success); }
        .sticky-error { color: var(--color-danger); }
        .sticky-close { border: none; background: none; font-size: 16px; line-height: 1; color: var(--color-muted); cursor: pointer; }
      `}</style>
    </>
  );
}
