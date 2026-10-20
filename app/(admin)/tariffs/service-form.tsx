"use client";

import { startTransition, useActionState, useEffect } from "react";
import type { ServicePricingType } from "@prisma/client";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { TariffFormState } from "@/actions/tariffs";
import { PRICING_TYPE_LABELS } from "@/lib/tariff-format";
import { TARIFF_FORM_CSS } from "./tariff-form";

// Карточка услуги: название, описание и цена. Как считается услуга (за кг, за заказ, %) задаёт программа.

export type ServiceFormValues = {
  code: string;
  name: string;
  description: string;
  pricingType: ServicePricingType;
  value: string;
  percentMin: string;
  percentMax: string;
  sortOrder: string;
  inPriceList: boolean;
  active: boolean;
};

type Props = {
  values: ServiceFormValues;
  action: (state: TariffFormState, formData: FormData) => Promise<TariffFormState>;
  isAdmin: boolean;
};

export default function ServiceForm({ values, action, isAdmin }: Props) {
  const [state, dispatch, isPending] = useActionState(action, {});
  const errors = state.error ?? {};
  const readOnly = !isAdmin;

  useEffect(() => {
    if (state.ok) toast.success("Услуга сохранена");
    else if (state.error) toast.error("Проверьте заполнение формы");
  }, [state]);

  const input = (name: keyof ServiceFormValues, label: string, hint?: string) => (
    <div className="field">
      <label className="field-label" htmlFor={`service-${name}`}>{label}</label>
      <input
        id={`service-${name}`}
        name={name}
        defaultValue={values[name] as string}
        inputMode={name === "name" ? undefined : "decimal"}
        disabled={readOnly}
        autoComplete="off"
        className={`field-input ${errors[name] ? "field-input--error" : ""}`}
      />
      {errors[name] && <p className="field-error">{errors[name]![0]}</p>}
      {hint && <p className="field-hint">{hint}</p>}
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
        <h2 className="section-title">Услуга</h2>
        <div className="field-grid">
          {input("name", "Название")}
          <div className="field">
            <span className="field-label">Как считается</span>
            <span className="field-static">{PRICING_TYPE_LABELS[values.pricingType]}</span>
          </div>
          <div className="field field--full">
            <label className="field-label" htmlFor="service-description">Описание</label>
            <textarea
              id="service-description"
              name="description"
              rows={2}
              defaultValue={values.description}
              disabled={readOnly}
              className={`field-input field-textarea ${errors.description ? "field-input--error" : ""}`}
            />
            {errors.description && <p className="field-error">{errors.description[0]}</p>}
            <p className="field-hint">Пояснение на странице тарифов в админке и кабинете.</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Цена</h2>
        <div className="field-grid field-grid--4">
          {(values.pricingType === "PER_KG" || values.pricingType === "PER_ORDER") &&
            input("value", values.pricingType === "PER_KG" ? "Цена, $ за кг" : "Цена, $ за заказ", "Новая цена — для новых расчётов; посчитанные посылки не меняются.")}
          {values.pricingType === "PERCENT" && (
            <>
              {input("percentMin", "От, %")}
              {input("percentMax", "До, %")}
            </>
          )}
          {values.pricingType === "MANUAL" && (
            <p className="field-hint field--full">Сумму вводят в карточке посылки.</p>
          )}
          {values.pricingType === "REQUEST" && (
            <p className="field-hint field--full">Цену называют клиенту по запросу.</p>
          )}
          {input("sortOrder", "Порядок", "Меньше — выше в списке.")}
        </div>
        <label className="check-row">
          <input type="checkbox" name="inPriceList" defaultChecked={values.inPriceList} disabled={readOnly} />
          <span>Показывать на странице тарифов</span>
        </label>
        <label className="check-row">
          <input type="checkbox" name="active" defaultChecked={values.active} disabled={readOnly} />
          <span>Действует — без отметки услуга не начисляется в посылках</span>
        </label>
      </section>

      {isAdmin ? (
        <div className="form-actions">
          <span className="form-actions-gap" />
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
            Сохранить
          </button>
        </div>
      ) : (
        <p className="field-hint">Изменение доступно только администратору.</p>
      )}

      <style>{TARIFF_FORM_CSS}</style>
    </form>
  );
}
