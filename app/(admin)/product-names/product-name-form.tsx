"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type FormState = { error?: Record<string, string[]> };
type ActionFn = (formData: FormData) => Promise<FormState | void>;

type ProductNameForForm = {
  id?: string;
  code: string;
  nameRu: string;
  nameEn: string | null;
  nameCn: string | null;
  category: string | null;
  parentId: string | null;
  hsCode: string | null;
  hsDescription: string | null;
};

type SectionOption = {
  id: string;
  code: string;
  nameRu: string;
};

type Props = {
  action: ActionFn;
  productName?: ProductNameForForm;
  /** секции верхнего уровня для выбора родителя */
  sections?: SectionOption[];
};

export default function ProductNameForm({ action, productName, sections = [] }: Props) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_state, formData) => (await action(formData)) ?? {},
    {}
  );
  const errors = state?.error;

  return (
    <form action={formAction} className="product-name-form">
      <div className="card">
        <h2 className="section-title">Карточка наименования</h2>
        <div className="field-grid">
          <div className="field">
            <label className="field-label">
              Код <span className="required">*</span>
            </label>
            <input
              type="text"
              name="code"
              defaultValue={productName?.code ?? ""}
              className={`field-input mono ${errors?.code ? "field-input--error" : ""}`}
              placeholder="PF-070000"
            />
            {errors?.code && <p className="field-error">{errors.code[0]}</p>}
          </div>

          <div className="field">
            <label className="field-label">
              Наименование RU <span className="required">*</span>
            </label>
            <input
              type="text"
              name="nameRu"
              defaultValue={productName?.nameRu ?? ""}
              className={`field-input ${errors?.nameRu ? "field-input--error" : ""}`}
              placeholder="Одежда"
            />
            {errors?.nameRu && <p className="field-error">{errors.nameRu[0]}</p>}
          </div>

          <div className="field">
            <label className="field-label">Наименование EN</label>
            <input
              type="text"
              name="nameEn"
              defaultValue={productName?.nameEn ?? ""}
              className="field-input"
              placeholder="Clothing"
            />
          </div>

          <div className="field">
            <label className="field-label">Наименование CN</label>
            <input
              type="text"
              name="nameCn"
              defaultValue={productName?.nameCn ?? ""}
              className="field-input"
              placeholder="衣服"
            />
          </div>

          <div className="field">
            <label className="field-label">Секция (раздел)</label>
            <select
              name="parentId"
              defaultValue={productName?.parentId ?? ""}
              className="field-input"
            >
              <option value="">— без секции (верхний уровень) —</option>
              {sections
                .filter((section) => section.id !== productName?.id)
                .map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.code} · {section.nameRu}
                  </option>
                ))}
            </select>
            <p className="field-hint">
              Позиция привязывается к секции; раздел подставится автоматически. Оставьте
              пустым, если это сама секция.
            </p>
          </div>

          <div className="field">
            <label className="field-label">HS-код (ТН ВЭД)</label>
            <input
              type="text"
              name="hsCode"
              defaultValue={productName?.hsCode ?? ""}
              className={`field-input mono ${errors?.hsCode ? "field-input--error" : ""}`}
              placeholder="6109 10"
            />
            {errors?.hsCode && <p className="field-error">{errors.hsCode[0]}</p>}
            {productName?.hsDescription && (
              <p className="field-hint">
                <strong>EU CN 2026:</strong> {productName.hsDescription}
              </p>
            )}
            <p className="field-hint">Тарифная классификация для таможни ЕС (€3 за позицию)</p>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Link href="/product-names" className="btn-secondary">
          Отмена
        </Link>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? (
            <>
              <Loader2 size={15} className="spin" />
              Сохранение...
            </>
          ) : productName ? (
            "Сохранить изменения"
          ) : (
            "Создать наименование"
          )}
        </button>
      </div>

      <style>{`
        .product-name-form { display: flex; flex-direction: column; gap: 20px; }
        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; box-shadow: var(--shadow-card); }
        .section-title { font-size: 15px; font-weight: 600; margin: 0 0 20px; color: var(--color-text); }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
        .required { color: var(--color-danger); }
        .field-input { padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
        .field-input--error { border-color: var(--color-danger); }
        .field-error { font-size: 12px; color: var(--color-danger); }
        .field-hint { font-size: 12px; color: var(--color-muted); margin: 2px 0 0; }
        .mono { font-family: var(--font-mono); }
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
