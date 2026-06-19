"use client";

import { useMemo, useState } from "react";
import { createOrder } from "@/actions/order-create";

type CustomerOpt = { id: string; code: string | null; name: string };
type RecipientOpt = { id: string; customerId: string; name: string };

export default function OrderForm({
  customers,
  recipients,
}: {
  customers: CustomerOpt[];
  recipients: RecipientOpt[];
}) {
  const [customerId, setCustomerId] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");

  const customerRecipients = useMemo(
    () => recipients.filter((r) => r.customerId === customerId),
    [recipients, customerId]
  );
  const declared = (Number(qty) || 0) * (Number(price) || 0);

  return (
    <form action={createOrder} className="of">
      <div className="of-grid">
        <label className="of-field">
          <span className="of-label">Клиент *</span>
          <select name="customerId" required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="of-input">
            <option value="">— выберите —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</option>
            ))}
          </select>
        </label>

        <label className="of-field">
          <span className="of-label">Получатель</span>
          <select name="recipientId" className="of-input" disabled={!customerId}>
            <option value="">— не выбран —</option>
            {customerRecipients.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>

        <label className="of-field">
          <span className="of-label">Вид доставки</span>
          <select name="deliveryType" className="of-input">
            <option value="">—</option>
            <option value="AUTO">Авто</option>
            <option value="AIR">Авиа</option>
            <option value="SEA">Море</option>
            <option value="EMS">EMS</option>
          </select>
        </label>

        <label className="of-field of-field--wide">
          <span className="of-label">Наименование *</span>
          <input name="productNameText" required className="of-input" placeholder="Напр. Кроссовки" />
        </label>

        <label className="of-field">
          <span className="of-label">Трек-номер (Китай)</span>
          <input name="trackNumber" className="of-input" placeholder="YT…CN" />
        </label>

        <label className="of-field">
          <span className="of-label">Количество *</span>
          <input name="quantity" type="number" min="1" required value={qty} onChange={(e) => setQty(e.target.value)} className="of-input" />
        </label>

        <label className="of-field">
          <span className="of-label">Цена за единицу, $</span>
          <input name="unitPriceUsd" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="of-input" placeholder="0.00" />
        </label>

        <label className="of-field">
          <span className="of-label">Объявленная стоимость, $</span>
          <input className="of-input of-input--ro" value={declared ? declared.toFixed(2) : ""} readOnly placeholder="авто = цена × кол-во" />
        </label>

        <label className="of-field">
          <span className="of-label">Вес, кг</span>
          <input name="actualWeightKg" type="number" min="0" step="0.01" className="of-input" placeholder="0.00" />
        </label>

        <label className="of-check">
          <input name="detailedCheckRequested" type="checkbox" />
          <span>Детальная проверка и фотоотчёт</span>
        </label>
      </div>

      <div className="of-actions">
        <button type="submit" className="of-submit">Создать заказ</button>
      </div>

      <style>{`
        .of { display: flex; flex-direction: column; gap: 18px; }
        .of-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .of-field { display: flex; flex-direction: column; gap: 5px; }
        .of-field--wide { grid-column: 1 / -1; }
        .of-label { font-size: 12px; font-weight: 600; color: var(--color-muted); }
        .of-input { padding: 9px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13.5px; color: var(--color-text); background: var(--color-surface); outline: none; transition: border-color 0.15s; }
        .of-input:focus { border-color: var(--color-accent); }
        .of-input--ro { background: var(--color-muted-bg); color: var(--color-muted); }
        .of-check { grid-column: 1 / -1; display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--color-text); }
        .of-actions { display: flex; justify-content: flex-end; }
        .of-submit { padding: 10px 20px; background: var(--color-accent); color: #fff; border: none; border-radius: var(--radius-sm); font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .of-submit:hover { opacity: 0.9; }
        @media (max-width: 640px) { .of-grid { grid-template-columns: 1fr; } }
      `}</style>
    </form>
  );
}
