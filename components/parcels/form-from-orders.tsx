"use client";

import { useState } from "react";
import { createParcelFromOrders } from "@/actions/parcel-form";

type Row = {
  id: string;
  productNameText: string | null;
  trackNumber: string | null;
  quantity: number;
  weight: string;
  customerId: string;
  customerName: string;
  customerCode: string | null;
  recipientName: string | null;
  deliveryType: string | null;
};

export default function FormFromOrders({
  rows,
  preselected = [],
}: {
  rows: Row[];
  preselected?: string[];
}) {
  // Предвыбор из списка заказов (?orderIds=…): берём только те, что реально
  // есть среди принятых заказов на этой странице.
  const [selected, setSelected] = useState<Set<string>>(() => {
    const ids = new Set(rows.map((r) => r.id));
    return new Set(preselected.filter((id) => ids.has(id)));
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Можно оформлять только заказы ОДНОГО клиента за раз
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const customerIds = new Set(selectedRows.map((r) => r.customerId));
  const multiCustomer = customerIds.size > 1;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const submit = async () => {
    if (selected.size === 0 || multiCustomer) {
      setErr(multiCustomer ? "Выберите заказы одного клиента" : "Выберите хотя бы один заказ");
      return;
    }
    setBusy(true); setErr(null);
    await createParcelFromOrders([...selected]);
    // редирект внутри action
  };

  if (rows.length === 0) {
    return <p className="ffo-empty">Нет принятых заказов, готовых к оформлению.</p>;
  }

  return (
    <div className="ffo">
      <ul className="ffo-list">
        {rows.map((r) => (
          <li key={r.id} className={`ffo-row ${selected.has(r.id) ? "on" : ""}`}>
            <label className="ffo-lbl">
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              <span className="ffo-info">
                <span className="ffo-name">{r.productNameText ?? "Товар"}</span>
                <span className="ffo-meta">
                  {r.trackNumber ?? "—"} · {r.quantity} шт · {r.weight} кг ·{" "}
                  <span className="ffo-code">{r.customerCode ?? ""}</span> {r.customerName}
                  {r.recipientName ? ` → ${r.recipientName}` : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="ffo-bar">
        {err && <span className="ffo-err">{err}</span>}
        <span className="ffo-count">Выбрано: {selected.size}</span>
        <button className="ffo-btn" disabled={busy || selected.size === 0} onClick={submit}>
          {busy ? "Оформляем…" : "Оформить в посылку"}
        </button>
      </div>

      <style>{`
        .ffo { display: flex; flex-direction: column; gap: 14px; }
        .ffo-empty { color: var(--color-muted); font-size: 14px; }
        .ffo-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .ffo-row { border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); }
        .ffo-row.on { border-color: var(--color-accent); background: oklch(52% 0.14 42 / 0.05); }
        .ffo-lbl { display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; }
        .ffo-info { display: flex; flex-direction: column; gap: 2px; }
        .ffo-name { font-size: 13.5px; font-weight: 600; }
        .ffo-meta { font-size: 12px; color: var(--color-muted); }
        .ffo-code { font-family: var(--font-mono); font-weight: 600; }
        .ffo-bar { display: flex; align-items: center; gap: 12px; justify-content: flex-end; padding-top: 8px; border-top: 1px solid var(--color-border); }
        .ffo-count { font-size: 13px; color: var(--color-muted); }
        .ffo-err { margin-right: auto; font-size: 12.5px; color: var(--color-status-canceled); }
        .ffo-btn { padding: 9px 18px; background: var(--color-accent); color: #fff; border: none; border-radius: var(--radius-sm); font-size: 13.5px; font-weight: 600; cursor: pointer; }
        .ffo-btn:disabled { opacity: 0.5; cursor: default; }
      `}</style>
    </div>
  );
}
