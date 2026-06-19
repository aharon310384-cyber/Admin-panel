"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, AlertTriangle } from "lucide-react";
import { receiveOrder } from "@/actions/order-receive";

type Row = {
  id: string;
  productNameText: string | null;
  trackNumber: string | null;
  quantity: number;
  customerName: string;
  customerCode: string | null;
  statusLabel: string;
};

export default function ReceivingArm({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const accept = async (id: string, discrepancy: boolean) => {
    if (busy) return;
    setBusy(id);
    const w = Number(weights[id]);
    await receiveOrder(id, Number.isFinite(w) && w > 0 ? w : null, discrepancy);
    setBusy(null);
    router.refresh();
  };

  if (rows.length === 0) {
    return <p className="arm-empty">Нет заказов, ожидающих приёма.</p>;
  }

  return (
    <ul className="arm-list">
      {rows.map((r) => (
        <li key={r.id} className="arm-row">
          <div className="arm-info">
            <span className="arm-name">{r.productNameText || "Товар"}</span>
            <span className="arm-meta">
              <span className="arm-track">{r.trackNumber || "без трека"}</span> · {r.quantity} шт ·{" "}
              <span className="arm-code">{r.customerCode || ""}</span> {r.customerName} · {r.statusLabel}
            </span>
          </div>
          <input
            className="arm-weight"
            type="number"
            min="0"
            step="0.01"
            placeholder="вес, кг"
            value={weights[r.id] ?? ""}
            onChange={(e) => setWeights((p) => ({ ...p, [r.id]: e.target.value }))}
          />
          <button className="arm-btn arm-btn--ok" disabled={busy === r.id} onClick={() => accept(r.id, false)}>
            <PackageCheck size={15} /> Принять
          </button>
          <button className="arm-btn arm-btn--warn" disabled={busy === r.id} onClick={() => accept(r.id, true)} title="Принят с несоответствием">
            <AlertTriangle size={15} />
          </button>
        </li>
      ))}

      <style>{`
        .arm-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .arm-empty { color: var(--color-muted); font-size: 14px; }
        .arm-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); }
        .arm-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .arm-name { font-size: 14px; font-weight: 600; color: var(--color-text); }
        .arm-meta { font-size: 12px; color: var(--color-muted); }
        .arm-track { font-family: var(--font-mono); }
        .arm-code { font-family: var(--font-mono); font-weight: 600; }
        .arm-weight { width: 110px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; outline: none; }
        .arm-weight:focus { border-color: var(--color-accent); }
        .arm-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .arm-btn:disabled { opacity: 0.5; cursor: default; }
        .arm-btn--ok { color: #fff; background: var(--color-accent); }
        .arm-btn--warn { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }
      `}</style>
    </ul>
  );
}
