"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createParcelFromOrders } from "@/actions/parcels";
import { formatCny, formatUsd } from "@/lib/utils";

type FinanceView = {
  exchangeRateCnyPerUsd: number;
};

export type FromOrdersOrder = {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
};

type Customer = {
  id: string;
  name: string;
  code: string | null;
  countryCode: string | null;
};

export default function FromOrdersForm({
  orders,
  customer,
  deliveryType,
  finance,
}: {
  orders: FromOrdersOrder[];
  customer: Customer;
  deliveryType: string;
  finance: FinanceView;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<Record<string, string[]>>({});

  const totalUsd = useMemo(
    () => orders.reduce((s, o) => s + o.price, 0),
    [orders]
  );

  const totalCny = totalUsd * finance.exchangeRateCnyPerUsd;

  const previewNumber =
    customer.code && customer.countryCode
      ? `${customer.code.toUpperCase()}…${customer.countryCode.toUpperCase()}`
      : null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError({});

    startTransition(async () => {
      const result = await createParcelFromOrders({
        orderIds: orders.map((o) => o.id),
        notes: notes.trim() || undefined,
      });

      if ("error" in result && result.error) {
        setError(result.error as Record<string, string[]>);
        const firstMessage =
          Object.values(result.error)[0]?.[0] ?? "Не удалось оформить посылку";
        toast.error(firstMessage);
        return;
      }

      if ("ok" in result && result.ok) {
        toast.success(`Посылка ${result.number} создана`);
        router.push(`/parcels/${result.parcelId}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="order-form">
      <div className="card">
        <h2 className="section-title">Получатель и доставка</h2>
        <div className="readonly-grid">
          <div className="readonly-row">
            <span className="readonly-label">Получатель</span>
            <span className="readonly-value">{customer.name}</span>
          </div>
          <div className="readonly-row">
            <span className="readonly-label">Тип доставки</span>
            <span className="readonly-value">{deliveryType || "—"}</span>
          </div>
        </div>
        {previewNumber && (
          <div className="preview-block">
            Номер посылки будет вида <strong>{previewNumber}</strong>
          </div>
        )}
        {error.customerId && (
          <p className="field-error">{error.customerId[0]}</p>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Курс для клиента</h2>
        <div className="rate-grid">
          <div className="field">
            <label className="field-label">Курс доллара к юаню</label>
            <input
              type="number"
              className="field-input"
              value={finance.exchangeRateCnyPerUsd}
              readOnly
              disabled
            />
          </div>
          <div className="rate-preview">
            <span>Сумма заказов</span>
            <strong>{formatUsd(totalUsd)}</strong>
          </div>
          <div className="rate-preview rate-preview--accent">
            <span>К оплате</span>
            <strong>{formatCny(totalCny)}</strong>
          </div>
        </div>
        <p className="muted-note">
          Курс подтягивается из справочника{" "}
          <Link href="/finance" className="link">
            Финансы
          </Link>
          . Локальная доставка и скидка задаются в карточке посылки.
        </p>
      </div>

      <div className="card">
        <div className="section-header">
          <h2 className="section-title">Заказы ({orders.length})</h2>
        </div>

        {error.orderIds && <p className="field-error">{error.orderIds[0]}</p>}

        <div className="items-list">
          {orders.map((o) => (
            <div key={o.id} className="item-readonly">
              <div className="item-info">
                <span className="mono">{o.sku}</span>
                <span className="item-name">{o.name}</span>
              </div>
              <span className="item-stock">{o.stock} шт.</span>
              <span className="tabular item-price">{formatUsd(o.price)}</span>
            </div>
          ))}
        </div>

        <div className="total-row">
          <span className="total-label">Итого:</span>
          <span className="total-value">{formatUsd(totalUsd)}</span>
          <span className="total-cny">{formatCny(totalCny)}</span>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Примечание</h2>
        <div className="field">
          <textarea
            className="field-input field-textarea"
            placeholder="Комментарий к посылке..."
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="form-actions">
        <Link href="/orders" className="btn-secondary">
          Отмена
        </Link>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? (
            <>
              <Loader2 size={15} className="spin" /> Создание...
            </>
          ) : (
            "Создать посылку"
          )}
        </button>
      </div>

      <style>{`
        .order-form { display: flex; flex-direction: column; gap: 20px; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; box-shadow: var(--shadow-card); }
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .section-title { font-size: 15px; font-weight: 600; margin: 0 0 20px; color: var(--color-text); }
        .section-header .section-title { margin-bottom: 0; }

        .readonly-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
        .readonly-row { display: flex; flex-direction: column; gap: 4px; padding: 10px 14px; background: var(--color-muted-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
        .readonly-label { font-size: 11.5px; font-weight: 500; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .readonly-value { font-size: 14px; font-weight: 500; color: var(--color-text); }

        .preview-block { margin-top: 14px; padding: 10px 14px; background: var(--color-muted-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 12.5px; color: var(--color-muted); }
        .preview-block strong { color: var(--color-text); font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.5px; }

        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
        .required { color: var(--color-danger); }
        .field-input { padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; width: 100%; }
        .field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
        .field-input--error { border-color: var(--color-danger); }
        .field-textarea { resize: vertical; min-height: 80px; font-family: var(--font-sans); line-height: 1.5; }
        .field-error { font-size: 12px; color: var(--color-danger); margin: 0; }

        .rate-grid { display: grid; grid-template-columns: minmax(180px, 1fr) 160px 160px; gap: 12px; align-items: end; }
        .rate-preview { min-height: 64px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 10px 12px; background: var(--color-muted-bg); display: flex; flex-direction: column; justify-content: center; gap: 4px; }
        .rate-preview span { font-size: 12px; color: var(--color-muted); }
        .rate-preview strong { font-size: 16px; color: var(--color-text); font-variant-numeric: tabular-nums; }
        .rate-preview--accent { background: var(--color-success-bg); border-color: color-mix(in srgb, var(--color-success) 24%, transparent); }
        .rate-preview--accent strong { color: var(--color-success); }

        .field-input:disabled { color: var(--color-muted); background: var(--color-muted-bg); cursor: not-allowed; }
        .muted-note { font-size: 12.5px; color: var(--color-muted); margin: 10px 0 0; line-height: 1.45; }
        .link { color: var(--color-accent); text-decoration: none; }
        .link:hover { text-decoration: underline; }

        .items-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .item-readonly { display: grid; grid-template-columns: 1fr 90px 110px; gap: 12px; align-items: center; padding: 10px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-muted-bg); }
        .item-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .item-info .mono { font-family: var(--font-mono); font-size: 12px; color: var(--color-muted); }
        .item-name { font-size: 13.5px; font-weight: 500; color: var(--color-text); white-space: pre-line; overflow-wrap: anywhere; }
        .item-stock { font-size: 13px; color: var(--color-muted); text-align: right; font-variant-numeric: tabular-nums; }
        .item-price { font-size: 14px; font-weight: 500; color: var(--color-text); text-align: right; font-variant-numeric: tabular-nums; }
        .tabular { font-variant-numeric: tabular-nums; }

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
          .item-readonly { grid-template-columns: 1fr 1fr; }
          .item-stock { display: none; }
        }
      `}</style>
    </form>
  );
}
