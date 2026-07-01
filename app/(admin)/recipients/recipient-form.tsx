"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type FormState = { error?: Record<string, string[]> };
type ActionFn = (formData: FormData) => Promise<FormState | void>;

type CountryOption = {
  code: string;
  nameRu: string;
  nameEn: string;
  postalCodeRegex: string | null;
  postalCodeExample: string | null;
};

type CustomerOption = {
  id: string;
  name: string;
  code: string | null;
};

type RecipientValues = {
  id: string;
  customerId: string;
  name: string;
  phone: string | null;
  countryCode: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
};

type Props = {
  customers: CustomerOption[];
  countries: CountryOption[];
  action: ActionFn;
  recipient?: RecipientValues;
  returnTo?: string;
};

function findCountry(countries: CountryOption[], value: string): CountryOption | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const code = trimmed.toUpperCase();
    return countries.find((c) => c.code === code) ?? null;
  }
  const lower = trimmed.toLowerCase();
  return (
    countries.find(
      (c) => c.nameRu.toLowerCase() === lower || c.nameEn.toLowerCase() === lower
    ) ?? null
  );
}

export default function RecipientForm({
  customers,
  countries,
  action,
  recipient,
  returnTo,
}: Props) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_state, formData) => (await action(formData)) ?? {},
    {}
  );

  const [country, setCountry] = useState(recipient?.country ?? "");
  const [countryCode, setCountryCode] = useState(recipient?.countryCode ?? "");

  const selectedCountry = useMemo(
    () => findCountry(countries, country),
    [countries, country]
  );

  function handleCountryChange(value: string) {
    setCountry(value);
    const match = findCountry(countries, value);
    if (match) setCountryCode(match.code);
  }

  const postalExample = selectedCountry?.postalCodeExample ?? "";
  const postalRegex = selectedCountry?.postalCodeRegex ?? null;
  const errors = state?.error;
  const isEdit = Boolean(recipient);
  const cancelHref = returnTo ?? (recipient ? `/recipients/${recipient.id}` : "/recipients");

  return (
    <form action={formAction} className="customer-form">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <div className="card">
        <h2 className="section-title">Данные получателя</h2>
        <div className="field-grid">
          <div className="field field--full">
            <label className="field-label">Клиент-владелец <span className="required">*</span></label>
            <select
              name="customerId"
              defaultValue={recipient?.customerId ?? ""}
              className={`field-input ${errors?.customerId ? "field-input--error" : ""}`}
            >
              <option value="" disabled>Выберите клиента…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} — ${c.name}` : c.name}
                </option>
              ))}
            </select>
            {errors?.customerId && <p className="field-error">{errors.customerId[0]}</p>}
          </div>

          <div className="field field--full">
            <label className="field-label">Имя получателя <span className="required">*</span></label>
            <input
              type="text"
              name="name"
              defaultValue={recipient?.name ?? ""}
              className={`field-input ${errors?.name ? "field-input--error" : ""}`}
              placeholder="Иван Иванов или название из инвойса"
            />
            {errors?.name && <p className="field-error">{errors.name[0]}</p>}
          </div>

          <div className="field">
            <label className="field-label">Телефон</label>
            <input
              type="tel"
              name="phone"
              defaultValue={recipient?.phone ?? ""}
              className="field-input"
              placeholder="+7 (999) 000-00-00"
            />
          </div>

          <div className="field">
            <label className="field-label">Страна</label>
            <input
              type="text"
              name="country"
              value={country}
              onChange={(e) => handleCountryChange(e.target.value)}
              list="country-options"
              className="field-input"
              placeholder="Spain"
              autoComplete="off"
            />
            <datalist id="country-options">
              {countries.map((c) => (
                <option key={c.code} value={c.nameRu}>
                  {c.code} — {c.nameEn}
                </option>
              ))}
            </datalist>
          </div>

          <div className="field">
            <label className="field-label">Код страны</label>
            <input
              type="text"
              name="countryCode"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              className={`field-input ${errors?.countryCode ? "field-input--error" : ""}`}
              placeholder="ES"
              maxLength={2}
              style={{ textTransform: "uppercase" }}
              autoComplete="off"
            />
            {errors?.countryCode && <p className="field-error">{errors.countryCode[0]}</p>}
          </div>

          <div className="field">
            <label className="field-label">Населённый пункт</label>
            <input
              type="text"
              name="city"
              defaultValue={recipient?.city ?? ""}
              className="field-input"
              placeholder="Мадрид"
            />
          </div>

          <div className="field">
            <label className="field-label">
              Почтовый индекс
              {postalExample && <span className="field-hint"> (пример: {postalExample})</span>}
            </label>
            <input
              type="text"
              name="postalCode"
              defaultValue={recipient?.postalCode ?? ""}
              className={`field-input ${errors?.postalCode ? "field-input--error" : ""}`}
              placeholder={postalExample || "100037"}
              pattern={postalRegex ?? undefined}
            />
            {errors?.postalCode && <p className="field-error">{errors.postalCode[0]}</p>}
          </div>

          <div className="field field--full">
            <label className="field-label">Адрес</label>
            <textarea
              name="address"
              defaultValue={recipient?.address ?? ""}
              className="field-input field-textarea"
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Link href={cancelHref} className="btn-secondary">
          Отмена
        </Link>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? (
            <>
              <Loader2 size={15} className="spin" />
              {isEdit ? "Сохранение…" : "Создание…"}
            </>
          ) : isEdit ? (
            "Сохранить изменения"
          ) : (
            "Создать получателя"
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
        .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
        .field-hint { color: var(--color-muted); font-weight: 400; }
        .required { color: var(--color-danger); }
        .field-input { padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
        .field-textarea { resize: vertical; min-height: 84px; }
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
        @media (max-width: 640px) { .field-grid { grid-template-columns: 1fr; } }
      `}</style>
    </form>
  );
}
