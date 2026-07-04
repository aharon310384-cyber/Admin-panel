"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type FormState = { error?: Record<string, string[]> };
type ActionFn = (formData: FormData) => Promise<FormState | void>;

type CountryOption = {
  code: string;
  nameRu: string;
  nameEn: string;
};

type Props = {
  countries: CountryOption[];
  action: ActionFn;
};

export default function ClientForm({ countries, action }: Props) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_state, formData) => (await action(formData)) ?? {},
    {}
  );

  const errors = state?.error;

  return (
    <form action={formAction} className="customer-form">
      <div className="card">
        <h2 className="section-title">Контактные данные</h2>
        <div className="field-grid">
          <div className="field field--full">
            <label className="field-label">
              КОД_КЛИЕНТА <span className="required">*</span>
            </label>
            <input
              type="text"
              name="code"
              className={`field-input field-input--code ${errors?.code ? "field-input--error" : ""}`}
              placeholder="YN"
              autoComplete="off"
              autoFocus
            />
            {errors?.code && <p className="field-error">{errors.code[0]}</p>}
          </div>

          <div className="field-row field-row--3">
            <div className="field">
              <label className="field-label">Фамилия</label>
              <input type="text" name="lastName" className="field-input" placeholder="Иванов" />
            </div>
            <div className="field">
              <label className="field-label">Имя</label>
              <input type="text" name="firstName" className="field-input" placeholder="Иван" />
            </div>
            <div className="field">
              <label className="field-label">Отчество</label>
              <input type="text" name="middleName" className="field-input" placeholder="Иванович" />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Email</label>
            <input
              type="email"
              name="email"
              className={`field-input ${errors?.email ? "field-input--error" : ""}`}
              placeholder="client@example.com"
              autoComplete="off"
            />
            {errors?.email && <p className="field-error">{errors.email[0]}</p>}
          </div>

          <div className="field">
            <label className="field-label">Telegram</label>
            <input type="text" name="telegramUsername" className="field-input" placeholder="@username" />
          </div>

          <div className="field">
            <label className="field-label">Телефон</label>
            <input
              type="tel"
              name="phone"
              className="field-input"
              placeholder="+7 903 111-44-55"
              inputMode="tel"
            />
          </div>

          <div className="field" />

          <div className="field">
            <label className="field-label">Страна</label>
            <input
              type="text"
              name="country"
              list="client-country-options"
              className="field-input"
              placeholder="Россия"
              autoComplete="off"
            />
            <datalist id="client-country-options">
              {countries.map((c) => (
                <option key={c.code} value={c.nameRu}>
                  {c.code} — {c.nameEn}
                </option>
              ))}
            </datalist>
          </div>

          <div className="field">
            <label className="field-label">Город</label>
            <input type="text" name="city" className="field-input" placeholder="Казань" />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Link href="/clients" className="btn-secondary">
          Отмена
        </Link>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? (
            <>
              <Loader2 size={15} className="spin" />
              Создание…
            </>
          ) : (
            "Создать клиента"
          )}
        </button>
      </div>

      <style>{`
        .customer-form { display: flex; flex-direction: column; gap: 20px; }
        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; box-shadow: var(--shadow-card); }
        .section-title { font-size: 15px; font-weight: 600; margin: 0 0 20px; color: var(--color-text); }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field--full { grid-column: 1 / -1; }
        .field-row { grid-column: 1 / -1; display: grid; gap: 16px; }
        .field-row--3 { grid-template-columns: repeat(3, 1fr); }
        .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
        .required { color: var(--color-danger); }
        .field-input { padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
        .field-input--code { max-width: 200px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.03em; }
        .field-input--error { border-color: var(--color-danger); }
        .field-error { font-size: 12px; color: var(--color-danger); }
        .form-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
        .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; }
        .btn-primary:hover { background: var(--color-accent-hover); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { display: inline-flex; align-items: center; padding: 10px 20px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; color: var(--color-text); text-decoration: none; transition: background 0.15s; }
        .btn-secondary:hover { background: var(--color-muted-bg); }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .field-grid { grid-template-columns: 1fr; }
          .field-row--3 { grid-template-columns: 1fr; }
        }
      `}</style>
    </form>
  );
}
