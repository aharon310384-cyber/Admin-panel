"use client";

import { startTransition, useActionState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteShippingTariff, type TariffFormState } from "@/actions/tariffs";

// Карточка тарифа доставки: чей тариф, направление и страны, вид доставки, цена, срок.

export type TariffFormValues = {
  id?: string;
  companyId: string;
  section: string;
  direction: string;
  countries: string; // названия стран через запятую
  deliveryType: string;
  cargoType: string;
  deliveryTarget: string;
  pricePerKgUsd: string;
  handlingFeeUsd: string;
  minDays: string;
  maxDays: string;
  volumetricDivisor: string;
  sortOrder: string;
  paymentTiming: "BEFORE" | "FLEXIBLE";
  onRequest: boolean;
  active: boolean;
};

type Option = { value: string; label: string };

type Props = {
  values: TariffFormValues;
  companies: Option[];
  deliveryMethods: Option[];
  sections: string[];
  action: (state: TariffFormState, formData: FormData) => Promise<TariffFormState>;
  isAdmin: boolean;
};

export default function TariffForm({ values, companies, deliveryMethods, sections, action, isAdmin }: Props) {
  const [state, dispatch, isPending] = useActionState(action, {});
  const [isDeleting, startDelete] = useTransition();
  const errors = state.error ?? {};
  const isNew = !values.id;
  const readOnly = !isAdmin;

  useEffect(() => {
    if (state.ok) toast.success("Тариф сохранён");
    else if (state.error) toast.error("Проверьте заполнение формы");
  }, [state]);

  const error = (name: keyof TariffFormValues) => errors[name] && <p className="field-error">{errors[name]![0]}</p>;

  const input = (name: keyof TariffFormValues, label: string, options: { placeholder?: string; hint?: string; required?: boolean; full?: boolean; inputMode?: "decimal" | "numeric"; list?: string } = {}) => (
    <div className={`field ${options.full ? "field--full" : ""}`}>
      <label className="field-label" htmlFor={`tariff-${name}`}>
        {label} {options.required && <span className="required">*</span>}
      </label>
      <input
        id={`tariff-${name}`}
        name={name}
        defaultValue={values[name] as string}
        placeholder={options.placeholder}
        inputMode={options.inputMode}
        list={options.list}
        disabled={readOnly}
        autoComplete="off"
        className={`field-input ${errors[name] ? "field-input--error" : ""}`}
      />
      {error(name)}
      {options.hint && <p className="field-hint">{options.hint}</p>}
    </div>
  );

  const select = (name: keyof TariffFormValues, label: string, options: Option[]) => (
    <div className="field">
      <label className="field-label" htmlFor={`tariff-${name}`}>{label} <span className="required">*</span></label>
      <select id={`tariff-${name}`} name={name} defaultValue={values[name] as string} disabled={readOnly} className={`field-input ${errors[name] ? "field-input--error" : ""}`}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {error(name)}
    </div>
  );

  return (
    // Отправка вручную, а не через action формы: иначе при ошибке React очистит то, что уже введено
    <form
      className="tariff-form"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      <section className="card">
        <h2 className="section-title">Направление</h2>
        <div className="field-grid">
          {select("companyId", "Компания", companies)}
          {input("section", "Раздел на странице тарифов", { placeholder: "Основные направления", list: "tariff-sections" })}
          <datalist id="tariff-sections">
            {sections.map((section) => <option key={section} value={section} />)}
          </datalist>
          {input("direction", "Направление", { placeholder: "Россия (авто)", required: true })}
          {input("cargoType", "Уточнение", { placeholder: "до 2 кг; простые товары" })}
          {input("countries", "Страны", {
            placeholder: "Германия, Франция, Италия",
            hint: "Через запятую — названия или коды стран. По стране получателя и виду доставки программа выбирает тариф посылки; если подходят несколько — первый по порядку.",
            full: true,
          })}
          {select("deliveryType", "Вид доставки", deliveryMethods)}
          {input("deliveryTarget", "Куда доставляем", { placeholder: "до двери/отделения" })}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Цена и срок</h2>
        <div className="field-grid field-grid--4">
          {input("pricePerKgUsd", "Ставка, $/кг", { inputMode: "decimal", required: true })}
          {input("handlingFeeUsd", "Оформление, $", { inputMode: "decimal" })}
          {input("minDays", "Срок от, дней", { inputMode: "numeric" })}
          {input("maxDays", "Срок до, дней", { inputMode: "numeric" })}
        </div>
        <label className="check-row">
          <input type="checkbox" name="onRequest" defaultChecked={values.onRequest} disabled={readOnly} />
          <span>Цена по запросу — показывается как «По запросу», в расчёт посылки тариф не берётся</span>
        </label>
      </section>

      <section className="card">
        <h2 className="section-title">Ещё</h2>
        <div className="field-grid field-grid--4">
          <div className="field">
            <label className="field-label" htmlFor="tariff-paymentTiming">Оплата</label>
            <select id="tariff-paymentTiming" name="paymentTiming" defaultValue={values.paymentTiming} disabled={readOnly} className="field-input">
              <option value="BEFORE">до отправки</option>
              <option value="FLEXIBLE">до или после отправки</option>
            </select>
          </div>
          {input("volumetricDivisor", "Делитель объёмного веса", { inputMode: "numeric", placeholder: "6000", hint: "Пусто — 6000." })}
          {input("sortOrder", "Порядок", { inputMode: "numeric", hint: "Меньше — выше в списке." })}
        </div>
        <label className="check-row">
          <input type="checkbox" name="active" defaultChecked={values.active} disabled={readOnly} />
          <span>Действует — показывается клиентам и берётся в расчёт посылки</span>
        </label>
      </section>

      {isAdmin ? (
        <div className="form-actions">
          {!isNew && (
            <button
              type="button"
              className="btn-delete"
              disabled={isDeleting || isPending}
              onClick={() => {
                if (confirm("Удалить тариф? Посчитанные посылки не изменятся.")) startDelete(() => deleteShippingTariff(values.id!));
              }}
            >
              {isDeleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              Удалить
            </button>
          )}
          <span className="form-actions-gap" />
          {isNew && <Link href="/tariffs" className="btn-secondary">Отмена</Link>}
          <button type="submit" disabled={isPending || isDeleting} className="btn-primary">
            {isPending ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
            {isNew ? "Создать" : "Сохранить"}
          </button>
        </div>
      ) : (
        <p className="field-hint">Изменение доступно только администратору.</p>
      )}

      <style>{TARIFF_FORM_CSS}</style>
    </form>
  );
}

// Общий вид карточек тарифа и услуги.
export const TARIFF_FORM_CSS = `
  .tariff-form { display: flex; flex-direction: column; gap: 16px; max-width: 920px; }
  .tariff-form .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px 16px; box-shadow: var(--shadow-card); }
  .section-title { font-size: 15px; font-weight: 600; margin: 0 0 16px; color: var(--color-text); }
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field-grid--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .field--full { grid-column: 1 / -1; }
  .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
  .field-static { padding: 10px 0; font-size: 13.5px; color: var(--color-text-secondary); }
  .required { color: var(--color-danger); }
  .field-input { padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; min-width: 0; }
  .field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
  .field-input:disabled { color: var(--color-muted); background: var(--color-muted-bg); }
  .field-input--error { border-color: var(--color-danger); }
  .field-textarea { resize: vertical; min-height: 64px; line-height: 1.45; }
  .field-error { font-size: 12px; color: var(--color-danger); margin: 0; }
  .field-hint { font-size: 12px; color: var(--color-muted); margin: 0; line-height: 1.45; }
  .check-row { display: flex; align-items: flex-start; gap: 8px; margin-top: 14px; font-size: 13px; color: var(--color-text); cursor: pointer; }
  .check-row input { margin-top: 2px; }
  .form-actions { display: flex; align-items: center; gap: 10px; }
  .form-actions-gap { flex: 1; }
  .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; }
  .btn-primary:hover { background: var(--color-accent-hover); }
  .btn-primary:disabled, .btn-delete:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { display: inline-flex; align-items: center; padding: 10px 20px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; color: var(--color-text); text-decoration: none; transition: background 0.15s; }
  .btn-secondary:hover { background: var(--color-muted-bg); }
  .btn-delete { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-muted); cursor: pointer; font-family: var(--font-sans); transition: all 0.15s; }
  .btn-delete:hover:not(:disabled) { color: var(--color-danger); border-color: var(--color-danger); background: var(--color-danger-bg); }
  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 720px) { .field-grid, .field-grid--4 { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 480px) { .field-grid, .field-grid--4 { grid-template-columns: 1fr; } }
`;
