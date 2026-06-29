"use client";

import { useMemo, useState } from "react";
import { createOrder } from "@/actions/order-create";

type CustomerOpt = { id: string; code: string | null; name: string };
type RecipientOpt = { id: string; customerId: string; name: string };
type ProductNameOpt = { id: string; code: string; nameRu: string; category: string | null; hsCode: string | null };

export type OrderInitial = {
  customerId: string;
  recipientId: string | null;
  deliveryType: string | null;
  productNameText: string;
  trackNumber: string | null;
  quantity: number;
  unitPriceUsd: number | null;
  actualWeightKg: number | null;
  detailedCheckRequested: boolean;
  keepOriginalPackaging: boolean;
};

export default function OrderForm({
  customers,
  recipients,
  productNames = [],
  action = createOrder,
  initial,
  submitLabel = "Создать заказ",
}: {
  customers: CustomerOpt[];
  recipients: RecipientOpt[];
  productNames?: ProductNameOpt[];
  action?: (formData: FormData) => Promise<void>;
  initial?: OrderInitial;
  submitLabel?: string;
}) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [qty, setQty] = useState(initial ? String(initial.quantity) : "1");
  const [price, setPrice] = useState(
    initial?.unitPriceUsd != null ? String(initial.unitPriceUsd) : ""
  );
  const [productText, setProductText] = useState(initial?.productNameText ?? "");

  const customerRecipients = useMemo(
    () => recipients.filter((r) => r.customerId === customerId),
    [recipients, customerId]
  );
  const declared = (Number(qty) || 0) * (Number(price) || 0);

  // Связь со справочником: точное совпадение по наименованию RU
  const matched = useMemo(() => {
    const t = productText.trim().toLowerCase();
    return t ? productNames.find((p) => p.nameRu.toLowerCase() === t) ?? null : null;
  }, [productNames, productText]);

  return (
    <form action={action} className="of">
      {/* Секция 1 — Маршрут */}
      <fieldset className="of-sec">
        <legend className="of-sec-title">Клиент и маршрут</legend>
        <div className="of-grid">
          <label className="of-field">
            <span className="of-label">Клиент <i>*</i></span>
            <select name="customerId" required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="of-input">
              <option value="">— выберите —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</option>
              ))}
            </select>
          </label>

          <label className="of-field">
            <span className="of-label">Получатель</span>
            <select name="recipientId" className="of-input" disabled={!customerId} defaultValue={initial?.recipientId ?? ""}>
              <option value="">— не выбран —</option>
              {customerRecipients.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>

          <label className="of-field of-field--wide">
            <span className="of-label">Вид доставки</span>
            <select name="deliveryType" className="of-input" defaultValue={initial?.deliveryType ?? ""}>
              <option value="">—</option>
              <option value="AUTO">Авто</option>
              <option value="AIR">Авиа</option>
              <option value="SEA">Море</option>
              <option value="EMS">EMS</option>
            </select>
          </label>
        </div>
      </fieldset>

      {/* Секция 2 — Товар */}
      <fieldset className="of-sec">
        <legend className="of-sec-title">Товар</legend>
        <div className="of-grid">
          <label className="of-field of-field--wide">
            <span className="of-label">Наименование <i>*</i></span>
            <input
              name="productNameText"
              required
              className="of-input"
              placeholder="Начните вводить — выбор из справочника"
              list="pn-list"
              value={productText}
              onChange={(e) => setProductText(e.target.value)}
              autoComplete="off"
            />
            <input type="hidden" name="productNameId" value={matched?.id ?? ""} />
            <datalist id="pn-list">
              {productNames.map((p) => (
                <option key={p.id} value={p.nameRu}>
                  {p.code}{p.hsCode ? ` · HS ${p.hsCode}` : ""}
                </option>
              ))}
            </datalist>
            {matched ? (
              matched.hsCode?.trim() ? (
                <span className="of-hint of-hint--ok">
                  Из справочника · {matched.category ?? "без секции"} · HS {matched.hsCode}
                </span>
              ) : (
                <span className="of-hint of-hint--warn">
                  Из справочника, но HS-код не указан — заполните в справочнике для пошлины ЕС
                </span>
              )
            ) : productText.trim() ? (
              <span className="of-hint of-hint--muted">Свободный ввод (нет в справочнике, без HS-кода)</span>
            ) : null}
          </label>

          <label className="of-field of-field--wide">
            <span className="of-label">Трек-номер (Китай)</span>
            <input name="trackNumber" className="of-input of-input--mono" placeholder="SF…" defaultValue={initial?.trackNumber ?? ""} />
          </label>
        </div>
      </fieldset>

      {/* Секция 3 — Количество, стоимость, вес */}
      <fieldset className="of-sec">
        <legend className="of-sec-title">Количество и стоимость</legend>
        <div className="of-grid of-grid--3">
          <label className="of-field">
            <span className="of-label">Количество <i>*</i></span>
            <input name="quantity" type="number" min="1" required value={qty} onChange={(e) => setQty(e.target.value)} className="of-input" />
          </label>

          <label className="of-field">
            <span className="of-label">Цена за ед., $</span>
            <input name="unitPriceUsd" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="of-input" placeholder="0.00" />
          </label>

          <label className="of-field">
            <span className="of-label">Вес, кг</span>
            <input name="actualWeightKg" type="number" min="0" step="0.01" className="of-input" placeholder="0.00" defaultValue={initial?.actualWeightKg != null ? String(initial.actualWeightKg) : ""} />
          </label>
        </div>

        <div className="of-declared">
          <span className="of-declared-label">Объявленная стоимость</span>
          <span className="of-declared-val">{declared ? `$${declared.toFixed(2)}` : "—"}</span>
          <span className="of-declared-hint">авто = цена × количество</span>
        </div>
      </fieldset>

      {/* Секция 4 — Услуги */}
      <fieldset className="of-sec">
        <legend className="of-sec-title">Доп. услуги</legend>
        <div className="of-checks">
          <label className="of-check">
            <input name="keepOriginalPackaging" type="checkbox" defaultChecked={initial?.keepOriginalPackaging ?? true} />
            <span>Оставить оригинальную упаковку</span>
          </label>
          <label className="of-check">
            <input name="detailedCheckRequested" type="checkbox" defaultChecked={initial?.detailedCheckRequested ?? false} />
            <span>Детальная проверка и фотоотчёт</span>
          </label>
        </div>
      </fieldset>

      <div className="of-actions">
        <button type="submit" className="of-submit">{submitLabel}</button>
      </div>

      <style>{`
        .of { display: flex; flex-direction: column; gap: 16px; }
        .of-sec { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; margin: 0; background: color-mix(in oklch, var(--color-muted-bg) 35%, var(--color-surface)); }
        .of-sec-title { padding: 0 8px; margin-left: -4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-accent); }
        .of-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .of-grid--3 { grid-template-columns: repeat(3, 1fr); }
        .of-field { display: flex; flex-direction: column; gap: 5px; }
        .of-field--wide { grid-column: 1 / -1; }
        .of-label { font-size: 12px; font-weight: 600; color: var(--color-muted); }
        .of-label i { color: var(--color-danger); font-style: normal; }
        .of-input { padding: 9px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); background: var(--color-surface); outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
        .of-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
        .of-input--mono { font-family: var(--font-mono); font-size: 12.5px; }
        .of-hint { font-size: 12px; margin-top: 1px; }
        .of-hint--ok { color: var(--color-status-completed); }
        .of-hint--warn { color: var(--color-danger); }
        .of-hint--muted { color: var(--color-muted); }

        .of-declared { display: flex; align-items: baseline; gap: 10px; margin-top: 14px; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--color-surface); border: 1px solid var(--color-border); }
        .of-declared-label { font-size: 12px; font-weight: 600; color: var(--color-muted); }
        .of-declared-val { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-text); margin-left: auto; }
        .of-declared-hint { font-size: 11px; color: var(--color-muted); }

        .of-checks { display: flex; flex-direction: column; gap: 12px; }
        .of-check { display: inline-flex; align-items: center; gap: 9px; font-size: 13.5px; color: var(--color-text); cursor: pointer; }
        .of-check input { width: 16px; height: 16px; accent-color: var(--color-accent); cursor: pointer; }

        .of-actions { display: flex; justify-content: flex-end; }
        .of-submit { padding: 11px 24px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .of-submit:hover { background: var(--color-accent-hover); }

        @media (max-width: 640px) {
          .of-grid, .of-grid--3 { grid-template-columns: 1fr; }
          .of-declared-val { margin-left: 0; }
        }
      `}</style>
    </form>
  );
}
