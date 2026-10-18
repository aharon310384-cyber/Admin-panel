"use client";

import { startTransition, useActionState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { CompanyFormState } from "@/actions/companies";

// Карточка компании: название, где показывается её бренд, сайт, контакты, тексты Telegram.

export type CompanyFormValues = {
  code: string;
  name: string;
  legalName: string | null;
  tagline: string | null;
  siteUrl: string | null;
  trackingUrl: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  address: string | null;
  telegramGreeting: string | null;
  telegramSignature: string | null;
  adminBrand: boolean;
  cabinetBrand: boolean;
};

type Props = {
  company?: CompanyFormValues; // нет — новая компания
  action: (state: CompanyFormState, formData: FormData) => Promise<CompanyFormState>;
  isAdmin: boolean;
};

export default function CompanyForm({ company, action, isAdmin }: Props) {
  const [state, dispatch, isPending] = useActionState(action, {});
  const errors = state.error ?? {};
  const isNew = !company;
  const readOnly = !isAdmin;

  useEffect(() => {
    if (state.ok) toast.success("Компания сохранена");
    else if (state.error) toast.error("Проверьте заполнение формы");
  }, [state]);

  const input = (name: keyof CompanyFormValues, label: string, options: { placeholder?: string; hint?: string; type?: string; required?: boolean; full?: boolean } = {}) => (
    <div className={`field ${options.full ? "field--full" : ""}`}>
      <label className="field-label" htmlFor={`company-${name}`}>
        {label} {options.required && <span className="required">*</span>}
      </label>
      <input
        id={`company-${name}`}
        name={name}
        type={options.type ?? "text"}
        defaultValue={(company?.[name] as string | null | undefined) ?? ""}
        placeholder={options.placeholder}
        disabled={readOnly}
        autoComplete="off"
        className={`field-input ${errors[name] ? "field-input--error" : ""}`}
      />
      {errors[name] && <p className="field-error">{errors[name]![0]}</p>}
      {options.hint && <p className="field-hint">{options.hint}</p>}
    </div>
  );

  const textarea = (name: keyof CompanyFormValues, label: string, hint: string, placeholder?: string) => (
    <div className="field field--full">
      <label className="field-label" htmlFor={`company-${name}`}>{label}</label>
      <textarea
        id={`company-${name}`}
        name={name}
        rows={2}
        defaultValue={(company?.[name] as string | null | undefined) ?? ""}
        placeholder={placeholder}
        disabled={readOnly}
        className={`field-input field-textarea ${errors[name] ? "field-input--error" : ""}`}
      />
      {errors[name] && <p className="field-error">{errors[name]![0]}</p>}
      <p className="field-hint">{hint}</p>
    </div>
  );

  return (
    // Отправка вручную, а не через action формы: иначе при ошибке React очистит то, что уже введено
    <form
      className="company-form"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      <section className="card">
        <h2 className="section-title">Компания</h2>
        <div className="field-grid">
          {isNew ? (
            input("code", "Код", { placeholder: "MYCARGO", hint: "Латиницей, для связей в системе. Потом не меняется.", required: true })
          ) : (
            <div className="field">
              <span className="field-label">Код</span>
              <span className="field-static">{company.code}</span>
            </div>
          )}
          {input("name", "Название", { placeholder: "Как пишется на экране", required: true })}
          {input("legalName", "Юридическое название", { placeholder: "Co., Ltd.", full: true })}
          {input("tagline", "Коротко о компании", {
            placeholder: "чем занимается компания, в двух-трёх словах",
            hint: "Для описания страниц кабинета: «Личный кабинет клиента <название> — <коротко>». Видно в превью ссылки.",
            full: true,
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Где показывается бренд</h2>
        <div className="brand-roles">
          <label className="brand-role">
            <input type="checkbox" name="adminBrand" defaultChecked={company?.adminBrand} disabled={readOnly} />
            <span>
              <strong>Админка (склад)</strong>
              <span className="field-hint">Название и знак в шапке админки и на входе сотрудников.</span>
            </span>
          </label>
          <label className="brand-role">
            <input type="checkbox" name="cabinetBrand" defaultChecked={company?.cabinetBrand} disabled={readOnly} />
            <span>
              <strong>Кабинет клиента и Telegram</strong>
              <span className="field-hint">Логотип и ссылки в кабинете, вход клиента, приветствие бота и подпись уведомлений.</span>
            </span>
          </label>
        </div>
        <p className="field-hint">Каждое место — только у одной компании: отметка здесь снимает её с другой компании.</p>
      </section>

      <section className="card">
        <h2 className="section-title">Сайт</h2>
        <div className="field-grid">
          {input("siteUrl", "Сайт", { placeholder: "https://…", hint: "Сюда ведёт логотип. Пусто — логотип без ссылки." })}
          {input("trackingUrl", "Страница отслеживания посылки", {
            placeholder: "https://…",
            hint: "Кнопка «Отследить» в кабинете копирует трек-номер и открывает эту страницу. Пусто — кнопки нет.",
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Контакты</h2>
        <div className="field-grid">
          {input("phone", "Телефон")}
          {input("email", "Email", { type: "email" })}
          {input("telegram", "Telegram", { placeholder: "@username" })}
          {input("address", "Адрес")}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Telegram</h2>
        <div className="field-grid">
          {textarea(
            "telegramGreeting",
            "Приветствие бота",
            "Первые слова бота, когда клиент ему пишет. Дальше бот сам просит подтвердить номер телефона. Пусто — «Здравствуйте! Это кабинет <название>.»",
            "Здравствуйте! Это кабинет …"
          )}
          {textarea(
            "telegramSignature",
            "Подпись под уведомлениями",
            "Добавляется в конце уведомлений клиенту о посылках. Пусто — без подписи."
          )}
        </div>
      </section>

      {isAdmin ? (
        <div className="form-actions">
          {isNew && <Link href="/companies" className="btn-secondary">Отмена</Link>}
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
            {isNew ? "Создать" : "Сохранить"}
          </button>
        </div>
      ) : (
        <p className="field-hint">Изменение доступно только администратору.</p>
      )}

      <style>{`
        .company-form { display: flex; flex-direction: column; gap: 16px; }
        .company-form .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px 16px; box-shadow: var(--shadow-card); }
        .section-title { font-size: 15px; font-weight: 600; margin: 0 0 16px; color: var(--color-text); }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .field--full { grid-column: 1 / -1; }
        .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
        .field-static { padding: 10px 0; font-family: var(--font-mono); font-size: 13px; color: var(--color-text-secondary); }
        .required { color: var(--color-danger); }
        .field-input { padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
        .field-input:disabled { color: var(--color-muted); background: var(--color-muted-bg); }
        .field-input--error { border-color: var(--color-danger); }
        .field-textarea { resize: vertical; min-height: 64px; line-height: 1.45; }
        .field-error { font-size: 12px; color: var(--color-danger); margin: 0; }
        .field-hint { font-size: 12px; color: var(--color-muted); margin: 0; line-height: 1.45; }
        .brand-roles { display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px; }
        .brand-role { display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; color: var(--color-text); cursor: pointer; }
        .brand-role input { margin-top: 3px; }
        .brand-role > span { display: flex; flex-direction: column; gap: 2px; }
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
