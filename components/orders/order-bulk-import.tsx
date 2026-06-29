"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { parseOrderText, createOrdersBulk } from "@/actions/order-import";
import type { ParsedOrderDraft } from "@/lib/ai-order-parser";

type CustomerOpt = { id: string; code: string | null; name: string };
type RecipientOpt = { id: string; customerId: string; name: string };

type Row = ParsedOrderDraft;

const DELIVERY_OPTS = [
  { value: "", label: "—" },
  { value: "AUTO", label: "Авто" },
  { value: "AIR", label: "Авиа" },
  { value: "SEA", label: "Море" },
  { value: "EMS", label: "EMS" },
] as const;

export default function OrderBulkImport({
  customers,
  recipients,
}: {
  customers: CustomerOpt[];
  recipients: RecipientOpt[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [parsing, startParse] = useTransition();
  const [saving, startSave] = useTransition();

  const customerRecipients = useMemo(
    () => recipients.filter((r) => r.customerId === customerId),
    [recipients, customerId],
  );

  const onParse = () => {
    if (!text.trim()) {
      toast.error("Вставьте текст с заказами");
      return;
    }
    startParse(async () => {
      const res = await parseOrderText(text);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows(res.orders);
      toast.success(`Распознано заказов: ${res.orders.length}`);
    });
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev));
  };
  const removeRow = (i: number) => {
    setRows((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev));
  };

  const onSave = () => {
    if (!customerId) {
      toast.error("Выберите клиента");
      return;
    }
    if (!rows || rows.length === 0) {
      toast.error("Нет заказов для создания");
      return;
    }
    startSave(async () => {
      const res = await createOrdersBulk({
        customerId,
        recipientId: recipientId || null,
        orders: rows,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Создано заказов: ${res.created}`);
      router.push("/orders");
      router.refresh();
    });
  };

  return (
    <section className="bi">
      <div className="bi-head">
        <span className="bi-icon"><Sparkles size={16} /></span>
        <div>
          <h2 className="bi-title">ИИ-разбор заказов</h2>
          <p className="bi-sub">Вставьте список товаров одним текстом — ИИ разложит его позаказно</p>
        </div>
      </div>

      <textarea
        className="bi-textarea"
        placeholder={"Например:\nКуртка зимняя, 2 шт, 35$, трек YT1234567890CN\nКроссовки Nike 42, 1 шт, 280¥\n..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
      />

      <div className="bi-actions">
        <button type="button" className="bi-parse" onClick={onParse} disabled={parsing}>
          {parsing ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {parsing ? "Разбираю…" : "Разобрать"}
        </button>
      </div>

      {rows && (
        <div className="bi-result">
          <div className="bi-assign">
            <label className="bi-field">
              <span className="bi-label">Клиент *</span>
              <select className="bi-input" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setRecipientId(""); }}>
                <option value="">— выберите —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</option>
                ))}
              </select>
            </label>
            <label className="bi-field">
              <span className="bi-label">Получатель</span>
              <select className="bi-input" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} disabled={!customerId}>
                <option value="">— не выбран —</option>
                {customerRecipients.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="bi-table-wrap">
            <table className="bi-table">
              <thead>
                <tr>
                  <th>Наименование</th>
                  <th>Кол-во</th>
                  <th>Цена $</th>
                  <th>Трек</th>
                  <th>Доставка</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input className="bi-cell" value={r.productNameText} onChange={(e) => updateRow(i, { productNameText: e.target.value })} />
                    </td>
                    <td>
                      <input className="bi-cell bi-cell--num" type="number" min={1} value={r.quantity} onChange={(e) => updateRow(i, { quantity: Number(e.target.value) || 1 })} />
                    </td>
                    <td>
                      <input className="bi-cell bi-cell--num" type="number" min={0} step="0.01" value={r.unitPriceUsd ?? ""} onChange={(e) => updateRow(i, { unitPriceUsd: e.target.value === "" ? null : Number(e.target.value) })} />
                    </td>
                    <td>
                      <input className="bi-cell bi-cell--mono" value={r.trackNumber ?? ""} onChange={(e) => updateRow(i, { trackNumber: e.target.value || null })} />
                    </td>
                    <td>
                      <select className="bi-cell" value={r.deliveryType ?? ""} onChange={(e) => updateRow(i, { deliveryType: (e.target.value || null) as Row["deliveryType"] })}>
                        {DELIVERY_OPTS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button type="button" className="bi-del" onClick={() => removeRow(i)} aria-label="Удалить строку">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="bi-empty">Все строки удалены</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bi-save-row">
            <button type="button" className="bi-save" onClick={onSave} disabled={saving || rows.length === 0}>
              {saving ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
              {saving ? "Создаю…" : `Создать все (${rows.length})`}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .bi { display: flex; flex-direction: column; gap: 14px; padding: 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
        .bi-head { display: flex; align-items: center; gap: 12px; }
        .bi-icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; color: var(--color-accent); background: oklch(52% 0.14 42 / 0.1); flex-shrink: 0; }
        .bi-title { margin: 0; font-size: 16px; font-weight: 700; color: var(--color-text); }
        .bi-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--color-muted); }
        .bi-textarea { width: 100%; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; font-family: var(--font-sans); color: var(--color-text); background: var(--color-surface); resize: vertical; outline: none; transition: border-color 0.15s; }
        .bi-textarea:focus { border-color: var(--color-accent); }
        .bi-actions { display: flex; }
        .bi-parse { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border: 1px solid var(--color-accent); border-radius: var(--radius-sm); background: var(--color-accent); color: var(--color-accent-fg); font-size: 13.5px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .bi-parse:hover { opacity: 0.9; }
        .bi-parse:disabled { opacity: 0.6; cursor: not-allowed; }

        .bi-result { display: flex; flex-direction: column; gap: 14px; padding-top: 4px; border-top: 1px solid var(--color-border); }
        .bi-assign { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .bi-field { display: flex; flex-direction: column; gap: 5px; }
        .bi-label { font-size: 12px; font-weight: 600; color: var(--color-muted); }
        .bi-input { padding: 9px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); background: var(--color-surface); outline: none; }
        .bi-input:focus { border-color: var(--color-accent); }

        .bi-table-wrap { overflow-x: auto; }
        .bi-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 640px; }
        .bi-table th { text-align: left; padding: 7px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); }
        .bi-table td { padding: 5px 6px; border-bottom: 1px solid var(--color-border); vertical-align: middle; }
        .bi-cell { width: 100%; padding: 7px 9px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text); background: var(--color-surface); outline: none; }
        .bi-cell:focus { border-color: var(--color-accent); }
        .bi-cell--num { max-width: 90px; font-variant-numeric: tabular-nums; }
        .bi-cell--mono { font-family: var(--font-mono); font-size: 12px; }
        .bi-del { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-muted); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
        .bi-del:hover { color: var(--color-danger); border-color: color-mix(in oklch, var(--color-danger) 40%, transparent); }
        .bi-empty { text-align: center; padding: 18px !important; color: var(--color-muted); }

        .bi-save-row { display: flex; justify-content: flex-end; }
        .bi-save { display: inline-flex; align-items: center; gap: 7px; padding: 10px 20px; border: none; border-radius: var(--radius-sm); background: var(--color-accent); color: var(--color-accent-fg); font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .bi-save:hover { opacity: 0.9; }
        .bi-save:disabled { opacity: 0.6; cursor: not-allowed; }

        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) { .bi-assign { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
