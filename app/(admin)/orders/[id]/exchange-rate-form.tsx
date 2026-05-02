"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateOrderExchangeRate } from "@/actions/orders";
import { formatCny, formatUsd } from "@/lib/utils";

type ExchangeRateFormProps = {
  orderId: string;
  totalUsd: number;
  totalCny: number;
  exchangeRateCnyPerUsd: number;
  localDeliveryCny: number;
  discountCny: number;
  isAdmin: boolean;
};

export default function ExchangeRateForm({
  orderId,
  totalUsd,
  totalCny,
  exchangeRateCnyPerUsd,
  localDeliveryCny,
  discountCny,
  isAdmin,
}: ExchangeRateFormProps) {
  const router = useRouter();
  const [rate, setRate] = useState(exchangeRateCnyPerUsd);
  const [isPending, startTransition] = useTransition();
  const recalculatedCny = totalUsd * rate + localDeliveryCny - discountCny;

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateOrderExchangeRate(orderId, formData);
      if (result?.error?.exchangeRateCnyPerUsd?.[0]) {
        toast.error(result.error.exchangeRateCnyPerUsd[0]);
        return;
      }
      toast.success("Курс обновлен");
      router.refresh();
    });
  };

  return (
    <form action={handleSubmit} className="exchange-form">
      <div className="money-grid">
        <div>
          <span className="money-label">Расчет</span>
          <strong>{formatUsd(totalUsd)}</strong>
        </div>
        <div>
          <span className="money-label">Зафиксировано к оплате</span>
          <strong>{formatCny(totalCny)}</strong>
        </div>
        <div>
          <span className="money-label">Пересчет по курсу</span>
          <strong>{formatCny(recalculatedCny)}</strong>
        </div>
      </div>

      <div className="rate-row">
        <label>
          <span>Курс $ к ¥</span>
          <input
            type="number"
            name="exchangeRateCnyPerUsd"
            min={0}
            step={0.0001}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            disabled={!isAdmin || isPending}
          />
        </label>
        {isAdmin && (
          <button type="submit" disabled={isPending} className="btn-save">
            {isPending ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
            Сохранить
          </button>
        )}
      </div>

      {!isAdmin && (
        <p className="rate-note">Курс зафиксирован для клиента. Исправление доступно администратору.</p>
      )}

      <style>{`
        .exchange-form { display: flex; flex-direction: column; gap: 14px; }
        .money-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .money-grid > div { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-muted-bg); }
        .money-label { color: var(--color-muted); font-size: 12px; }
        .money-grid strong { color: var(--color-text); font-size: 16px; font-variant-numeric: tabular-nums; }
        .rate-row { display: flex; align-items: end; gap: 10px; flex-wrap: wrap; }
        .rate-row label { display: flex; flex-direction: column; gap: 6px; min-width: 180px; color: var(--color-text); font-size: 13px; font-weight: 500; }
        .rate-row input { height: 40px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; }
        .rate-row input:focus { outline: none; border-color: var(--color-accent); }
        .rate-row input:disabled { color: var(--color-muted); }
        .btn-save { height: 40px; display: inline-flex; align-items: center; gap: 6px; padding: 0 14px; border: none; border-radius: var(--radius-sm); background: var(--color-accent); color: var(--color-accent-fg); cursor: pointer; font-weight: 600; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .rate-note { margin: 0; color: var(--color-muted); font-size: 12px; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 760px) { .money-grid { grid-template-columns: 1fr; } }
      `}</style>
    </form>
  );
}
