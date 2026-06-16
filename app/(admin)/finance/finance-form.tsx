"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateFinanceSettings } from "@/actions/finance";
import { formatDateTime } from "@/lib/utils";
import type { FinanceSettingsView } from "@/lib/finance";

export default function FinanceForm({
  settings,
  isAdmin,
}: {
  settings: FinanceSettingsView;
  isAdmin: boolean;
}) {
  const [exchangeRate, setExchangeRate] = useState(settings.exchangeRateCnyPerUsd);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateFinanceSettings(formData);
      if (result && "error" in result && result.error) {
        setErrors(result.error as Record<string, string[]>);
        toast.error("Проверьте заполнение формы");
        return;
      }
      toast.success("Финансовые настройки обновлены");
    });
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="grid">
        <div className="field">
          <label className="field-label" htmlFor="exchangeRateCnyPerUsd">
            Курс CNY / USD <span className="required">*</span>
          </label>
          <input
            id="exchangeRateCnyPerUsd"
            name="exchangeRateCnyPerUsd"
            type="number"
            min={0}
            step={0.0001}
            value={exchangeRate}
            onChange={(e) => setExchangeRate(Number(e.target.value))}
            disabled={!isAdmin}
            className={`field-input ${errors.exchangeRateCnyPerUsd ? "field-input--error" : ""}`}
          />
          {errors.exchangeRateCnyPerUsd && (
            <p className="field-error">{errors.exchangeRateCnyPerUsd[0]}</p>
          )}
          <p className="field-hint">
            Подтягивается во все новые посылки. Локальная доставка и скидка
            задаются индивидуально в карточке посылки.
          </p>
        </div>
      </div>

      <p className="meta">
        Обновлено: {formatDateTime(settings.updatedAt)}
      </p>

      {isAdmin && (
        <div className="actions">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
            Сохранить
          </button>
        </div>
      )}

      {!isAdmin && (
        <p className="meta">Изменение доступно только администратору.</p>
      )}

      <style>{`
        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: 16px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
        .required { color: var(--color-danger); }
        .field-input { padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
        .field-input--error { border-color: var(--color-danger); }
        .field-input:disabled { color: var(--color-muted); background: var(--color-muted-bg); }
        .field-error { font-size: 12px; color: var(--color-danger); margin: 0; }
        .field-hint { font-size: 12px; color: var(--color-muted); margin: 4px 0 0; line-height: 1.45; }
        .meta { font-size: 12px; color: var(--color-muted); margin: 0; }
        .actions { display: flex; justify-content: flex-end; }
        .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 13.5px; font-weight: 500; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; }
        .btn-primary:hover { background: var(--color-accent-hover); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
