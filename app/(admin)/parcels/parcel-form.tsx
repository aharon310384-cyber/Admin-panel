"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createParcel } from "@/actions/parcels";
import { formatCny, formatUsd } from "@/lib/utils";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  code: string | null;
  clientCode: string | null;
  country: string | null;
  countryCode: string | null;
};
type Product = { id: string; name: string; sku: string; price: number };
type Item = { productId: string; quantity: number; price: number };

const RETURN_PATH = "/parcels/new";

export default function ParcelForm({
  customers,
  products,
  initialCustomerId,
}: {
  customers: Customer[];
  products: Product[];
  initialCustomerId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<Item[]>([{ productId: "", quantity: 1, price: 0 }]);
  const [exchangeRate, setExchangeRate] = useState(7.1);
  const [error, setError] = useState<Record<string, string[]>>({});
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId]
  );

  const missing = useMemo(() => {
    if (!selectedCustomer) return [] as string[];
    const result: string[] = [];
    const clientCode = (selectedCustomer.clientCode ?? selectedCustomer.code ?? "").trim();
    if (!clientCode) result.push("код клиента");
    if (!(selectedCustomer.countryCode ?? "").trim()) result.push("код страны");
    return result;
  }, [selectedCustomer]);

  const previewNumber = useMemo(() => {
    if (!selectedCustomer || missing.length > 0) return null;
    const prefix = (selectedCustomer.clientCode ?? selectedCustomer.code ?? "").trim().toUpperCase();
    const suffix = (selectedCustomer.countryCode ?? "").trim().toUpperCase();
    return `${prefix}…${suffix}`;
  }, [selectedCustomer, missing]);

  const editUrl = selectedCustomer
    ? `/recipients/${selectedCustomer.id}/edit?returnTo=${encodeURIComponent(
        `${RETURN_PATH}?customerId=${selectedCustomer.id}`
      )}`
    : null;
  const createUrl = `/recipients/new?returnTo=${encodeURIComponent(
    `${RETURN_PATH}?customerId={customerId}`
  )}`;

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalCny = total * exchangeRate;

  const addItem = () =>
    setItems((prev) => [...prev, { productId: "", quantity: 1, price: 0 }]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof Item, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      if (field === "productId") {
        const product = products.find((p) => p.id === value);
        next[idx] = { ...next[idx], productId: value as string, price: product?.price ?? 0 };
      } else {
        next[idx] = { ...next[idx], [field]: Number(value) };
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError({});
    const formData = new FormData(e.currentTarget);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      const result = await createParcel(formData);
      if (result?.error) {
        setError(result.error as Record<string, string[]>);
        toast.error("Проверьте заполнение формы");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="order-form">
      <div className="card">
        <div className="section-header">
          <h2 className="section-title">Получатель</h2>
          <Link href={createUrl} className="btn-add">
            <UserPlus size={14} /> Создать получателя
          </Link>
        </div>
        <div className="field">
          <label className="field-label">
            Получатель <span className="required">*</span>
          </label>
          <select
            name="customerId"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className={`field-input ${error.customerId ? "field-input--error" : ""}`}
          >
            <option value="">— Выберите получателя —</option>
            {customers.map((c) => {
              const code = (c.clientCode ?? c.code ?? "").trim();
              const ctry = (c.countryCode ?? "").trim();
              const tags = [code, ctry].filter(Boolean).join(" · ");
              return (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {tags ? ` [${tags}]` : ""}
                  {c.email ? ` (${c.email})` : ""}
                </option>
              );
            })}
          </select>
          {error.customerId && <p className="field-error">{error.customerId[0]}</p>}
        </div>

        {selectedCustomer && missing.length > 0 && editUrl && (
          <div className="warning-block">
            <AlertTriangle size={16} className="warning-icon" />
            <div className="warning-body">
              <p className="warning-title">
                У получателя не заполнено: {missing.join(", ")}
              </p>
              <p className="warning-text">
                Номер посылки собирается из кода клиента, сквозного номера и кода страны
                получателя. Дозаполните карточку — после сохранения вернётесь сюда.
              </p>
              <Link href={editUrl} className="btn-warning">
                Открыть карточку получателя
              </Link>
            </div>
          </div>
        )}

        {selectedCustomer && missing.length === 0 && previewNumber && (
          <div className="preview-block">
            Номер посылки будет вида <strong>{previewNumber}</strong>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Курс для клиента</h2>
        <div className="rate-grid">
          <div className="field">
            <label className="field-label">
              Курс доллара к юаню <span className="required">*</span>
            </label>
            <input
              type="number"
              name="exchangeRateCnyPerUsd"
              className={`field-input ${error.exchangeRateCnyPerUsd ? "field-input--error" : ""}`}
              min={0}
              step={0.0001}
              value={exchangeRate}
              onChange={(e) => setExchangeRate(Number(e.target.value))}
            />
            {error.exchangeRateCnyPerUsd && (
              <p className="field-error">{error.exchangeRateCnyPerUsd[0]}</p>
            )}
          </div>
          <div className="rate-preview">
            <span>Расчет</span>
            <strong>{formatUsd(total)}</strong>
          </div>
          <div className="rate-preview rate-preview--accent">
            <span>К оплате</span>
            <strong>{formatCny(totalCny)}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-header">
        <h2 className="section-title">Заказы</h2>
        <button type="button" className="btn-add" onClick={addItem}>
            <Plus size={14} /> Добавить заказ
          </button>
        </div>

        {error.items && <p className="field-error">{error.items[0]}</p>}

        <div className="items-list">
          {items.map((item, idx) => (
            <div key={idx} className="item-row">
              <div className="item-product">
                <label className="field-label">Заказ</label>
                <select
                  className="field-input"
                  value={item.productId}
                  onChange={(e) => updateItem(idx, "productId", e.target.value)}
                >
                  <option value="">— Выберите заказ —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="item-qty">
                <label className="field-label">Кол-во</label>
                <input
                  type="number"
                  className="field-input"
                  value={item.quantity}
                  min={1}
                  onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                />
              </div>

              <div className="item-price">
                <label className="field-label">Стоимость за единицу, $</label>
                <input
                  type="number"
                  className="field-input"
                  value={item.price}
                  min={0}
                  step={0.01}
                  onChange={(e) => updateItem(idx, "price", e.target.value)}
                />
              </div>

              <div className="item-subtotal">
                <label className="field-label">Сумма</label>
                <span className="subtotal-value">{formatUsd(item.price * item.quantity)}</span>
              </div>

              <button
                type="button"
                className="btn-remove"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
                aria-label="Удалить строку"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="total-row">
          <span className="total-label">Итого:</span>
          <span className="total-value">{formatUsd(total)}</span>
          <span className="total-cny">{formatCny(totalCny)}</span>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Примечание</h2>
        <div className="field">
          <textarea
            name="notes"
            className="field-input field-textarea"
            placeholder="Комментарий к посылке..."
            rows={3}
          />
        </div>
      </div>

      <div className="form-actions">
        <Link href="/parcels" className="btn-secondary">Отмена</Link>
        <button
          type="submit"
          disabled={isPending || missing.length > 0 || !selectedCustomer}
          className="btn-primary"
        >
          {isPending ? (
            <><Loader2 size={15} className="spin" /> Создание...</>
          ) : (
            "Создать посылку"
          )}
        </button>
      </div>

      <style>{`
        .order-form { display: flex; flex-direction: column; gap: 20px; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; box-shadow: var(--shadow-card); }

        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .section-header > .btn-add { margin-bottom: 0; }

        .warning-block { display: flex; gap: 10px; margin-top: 14px; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--color-warning) 28%, transparent); background: var(--color-warning-bg); border-radius: var(--radius-sm); }
        .warning-icon { color: var(--color-warning); flex-shrink: 0; margin-top: 2px; }
        .warning-body { display: flex; flex-direction: column; gap: 6px; }
        .warning-title { font-size: 13px; font-weight: 600; color: var(--color-text); margin: 0; }
        .warning-text { font-size: 12.5px; color: var(--color-muted); margin: 0; line-height: 1.4; }
        .btn-warning { display: inline-flex; width: fit-content; align-items: center; padding: 6px 12px; background: var(--color-warning); color: #fff; border: none; border-radius: var(--radius-sm); font-size: 12.5px; font-weight: 600; text-decoration: none; transition: opacity 0.15s; margin-top: 4px; }
        .btn-warning:hover { opacity: 0.9; }

        .preview-block { margin-top: 12px; padding: 10px 14px; background: var(--color-muted-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 12.5px; color: var(--color-muted); }
        .preview-block strong { color: var(--color-text); font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.5px; }
        .section-title { font-size: 15px; font-weight: 600; margin: 0 0 20px; color: var(--color-text); }
        .section-header .section-title { margin-bottom: 0; }

        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
        .required { color: var(--color-danger); }
        .field-input { padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; width: 100%; }
        .field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
        .field-input--error { border-color: var(--color-danger); }
        .field-textarea { resize: vertical; min-height: 80px; font-family: var(--font-sans); line-height: 1.5; }
        .field-error { font-size: 12px; color: var(--color-danger); margin: 0; }

        .items-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }

        .item-row { display: grid; grid-template-columns: 1fr 80px 120px 110px 36px; gap: 10px; align-items: end; }
        .rate-grid { display: grid; grid-template-columns: minmax(180px, 1fr) 160px 160px; gap: 12px; align-items: end; }
        .rate-preview { min-height: 64px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 10px 12px; background: var(--color-muted-bg); display: flex; flex-direction: column; justify-content: center; gap: 4px; }
        .rate-preview span { font-size: 12px; color: var(--color-muted); }
        .rate-preview strong { font-size: 16px; color: var(--color-text); font-variant-numeric: tabular-nums; }
        .rate-preview--accent { background: var(--color-success-bg); border-color: color-mix(in srgb, var(--color-success) 24%, transparent); }
        .rate-preview--accent strong { color: var(--color-success); }

        .subtotal-value { display: flex; align-items: center; height: 42px; font-size: 14px; font-weight: 500; color: var(--color-text); font-variant-numeric: tabular-nums; }

        .btn-remove { display: flex; align-items: center; justify-content: center; width: 36px; height: 42px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-danger); cursor: pointer; transition: background 0.15s; flex-shrink: 0; }
        .btn-remove:hover:not(:disabled) { background: oklch(52% 0.18 22 / 0.08); }
        .btn-remove:disabled { opacity: 0.3; cursor: not-allowed; }

        .btn-add { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-text); cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; white-space: nowrap; }
        .btn-add:hover { background: var(--color-muted-bg); }

        .total-row { display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding-top: 16px; border-top: 1px solid var(--color-border); }
        .total-label { font-size: 14px; font-weight: 500; color: var(--color-muted); }
        .total-value { font-size: 18px; font-weight: 700; color: var(--color-text); font-variant-numeric: tabular-nums; }
        .total-cny { font-size: 18px; font-weight: 700; color: var(--color-success); font-variant-numeric: tabular-nums; }

        .form-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }

        .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; }
        .btn-primary:hover { background: var(--color-accent-hover); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-secondary { display: inline-flex; align-items: center; padding: 10px 20px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; color: var(--color-text); text-decoration: none; transition: background 0.15s; }
        .btn-secondary:hover { background: var(--color-muted-bg); }

        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .rate-grid { grid-template-columns: 1fr; }
          .item-row { grid-template-columns: 1fr 1fr; }
          .item-price, .item-subtotal { display: none; }
        }
      `}</style>
    </form>
  );
}
