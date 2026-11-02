"use client";

// АРМ «Приём заказа»: ожидающие заказы сгруппированы по входящему треку — коробке. Коробка принимается целиком
// одним весом (документ «Приём заказа»); товар, которого в коробке нет, снимают галочкой — он остаётся ждать.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { receiveBox } from "@/actions/order-receive";

type Row = {
  id: string;
  productNameText: string | null;
  trackNumber: string | null;
  quantity: number;
  customerName: string;
  customerCode: string | null;
  statusLabel: string;
};

type Box = { key: string; track: string | null; rows: Row[] };

const trackKey = (track: string | null) => (track ?? "").trim().toUpperCase();

/** 1 товар, 2 товара, 5 товаров */
function goods(n: number) {
  const tens = n % 100;
  const last = n % 10;
  return `${n} ${tens >= 11 && tens <= 14 ? "товаров" : last === 1 ? "товар" : last >= 2 && last <= 4 ? "товара" : "товаров"}`;
}

export default function ReceivingArm({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  // Коробка — заказы с одним треком, в порядке появления; заказ без трека — своя коробка.
  const boxes = useMemo(() => {
    const byKey = new Map<string, Box>();
    for (const r of rows) {
      const key = trackKey(r.trackNumber) || `id:${r.id}`;
      const box = byKey.get(key) ?? { key, track: r.trackNumber?.trim() || null, rows: [] };
      box.rows.push(r);
      byKey.set(key, box);
    }
    return [...byKey.values()];
  }, [rows]);

  const toggle = (id: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const accept = async (box: Box, discrepancy: boolean) => {
    if (busy) return;
    const ids = box.rows.filter((r) => !skipped.has(r.id)).map((r) => r.id);
    if (!ids.length) {
      toast.error("Отметьте товары, которые есть в коробке");
      return;
    }
    setBusy(box.key);
    const w = Number(weights[box.key]?.replace(",", "."));
    const result = await receiveBox(ids, Number.isFinite(w) && w > 0 ? w : null, discrepancy);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Принято: ${goods(result.count)} · ${result.number}`);
    router.refresh();
  };

  if (rows.length === 0) {
    return <p className="arm-empty">Нет заказов, ожидающих приёма.</p>;
  }

  return (
    <ul className="arm-list">
      {boxes.map((box) => {
        const many = box.rows.length > 1;
        const chosen = box.rows.filter((r) => !skipped.has(r.id)).length;
        return (
          <li key={box.key} className="arm-box">
            <div className="arm-head">
              <span className="arm-track">{box.track ?? "без трека"}</span>
              {many && <span className="arm-count">{goods(box.rows.length)} в коробке</span>}
            </div>
            <ul className="arm-items">
              {box.rows.map((r) => (
                <li key={r.id} className={skipped.has(r.id) ? "arm-item arm-item--off" : "arm-item"}>
                  {many && (
                    <input
                      type="checkbox"
                      checked={!skipped.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`Есть в коробке: ${r.productNameText || "товар"}`}
                    />
                  )}
                  <span className="arm-name">{r.productNameText || "Товар"}</span>
                  <span className="arm-meta">
                    {r.quantity} шт · <span className="arm-code">{r.customerCode || ""}</span> {r.customerName} · {r.statusLabel}
                  </span>
                </li>
              ))}
            </ul>
            <div className="arm-actions">
              <input
                className="arm-weight"
                type="number"
                min="0"
                step="0.01"
                placeholder={many ? "вес коробки, кг" : "вес, кг"}
                aria-label={many ? "Вес коробки, кг" : "Вес, кг"}
                value={weights[box.key] ?? ""}
                onChange={(e) => setWeights((p) => ({ ...p, [box.key]: e.target.value }))}
              />
              <button className="arm-btn arm-btn--ok" disabled={busy === box.key || chosen === 0} onClick={() => accept(box, false)}>
                <PackageCheck size={15} /> {many ? (chosen === box.rows.length ? "Принять коробку" : `Принять ${goods(chosen)}`) : "Принять"}
              </button>
              <button
                className="arm-btn arm-btn--warn"
                disabled={busy === box.key || chosen === 0}
                onClick={() => accept(box, true)}
                title="Принять с несоответствием"
                aria-label="Принять с несоответствием"
              >
                <AlertTriangle size={15} />
              </button>
              {many && <span className="arm-hint">вес делится между товарами поровну</span>}
            </div>
          </li>
        );
      })}

      <style>{`
        .arm-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .arm-empty { color: var(--color-muted); font-size: 14px; }
        .arm-box { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); }
        .arm-head { display: flex; align-items: baseline; gap: 10px; }
        .arm-track { font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: var(--color-text); }
        .arm-count { font-size: 12px; font-weight: 600; color: var(--color-accent); }
        .arm-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .arm-item { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; }
        .arm-item input { accent-color: var(--color-accent); align-self: center; }
        .arm-item--off .arm-name, .arm-item--off .arm-meta { opacity: 0.45; text-decoration: line-through; }
        .arm-name { font-size: 14px; font-weight: 600; color: var(--color-text); }
        .arm-meta { font-size: 12px; color: var(--color-muted); }
        .arm-code { font-family: var(--font-mono); font-weight: 600; }
        .arm-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
        .arm-weight { width: 140px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; outline: none; }
        .arm-weight:focus { border-color: var(--color-accent); }
        .arm-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .arm-btn:disabled { opacity: 0.5; cursor: default; }
        .arm-btn--ok { color: #fff; background: var(--color-accent); }
        .arm-btn--warn { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }
        .arm-hint { font-size: 11.5px; color: var(--color-muted); }
      `}</style>
    </ul>
  );
}
