"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Link2, Package, Plus, Trash2, User } from "lucide-react";

type Item = {
  id: number;
  url: string;
  name: string;
  qty: string;
  price: string;
};

let nextId = 2;

const emptyItem = (id: number): Item => ({ id, url: "", name: "", qty: "1", price: "" });

export default function ClientCabinetNewOrderPage() {
  const [items, setItems] = useState<Item[]>([emptyItem(1)]);
  const [recipient, setRecipient] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  const updateItem = (id: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addItem = () => setItems((prev) => [...prev, emptyItem(nextId++)]);
  const removeItem = (id: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));

  const total = items.reduce((sum, it) => {
    const q = parseFloat(it.qty) || 0;
    const p = parseFloat(it.price) || 0;
    return sum + q * p;
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: подключить server action создания заявки клиента (пока визуальный прототип)
    setSent(true);
  };

  if (sent) {
    return (
      <div className="nw-done">
        <span className="nw-done-icon"><Check size={34} strokeWidth={3} /></span>
        <h1 className="nw-done-title">Заявка оформлена</h1>
        <p className="nw-done-sub">
          Менеджер свяжется с вами для подтверждения. Скоро эта заявка появится в разделе «Посылки».
        </p>
        <Link href="/cabinet" className="nw-done-btn">На главную</Link>
        <style>{doneStyles}</style>
      </div>
    );
  }

  return (
    <form className="nw" onSubmit={handleSubmit}>
      <header className="nw-head">
        <h1 className="nw-title">Оформить заказ</h1>
        <p className="nw-sub">Добавьте товары и укажите получателя</p>
      </header>

      <section className="nw-block">
        <div className="nw-block-head">
          <span className="nw-block-icon"><Package size={15} /></span>
          <span className="nw-block-title">Товары</span>
        </div>

        {items.map((it, idx) => (
          <div key={it.id} className="nw-item">
            <div className="nw-item-top">
              <span className="nw-item-n">#{idx + 1}</span>
              {items.length > 1 && (
                <button type="button" className="nw-item-del" onClick={() => removeItem(it.id)} aria-label="Удалить товар">
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <label className="nw-field">
              <span className="nw-label"><Link2 size={13} /> Ссылка на товар</span>
              <input
                className="nw-input" type="url" inputMode="url" placeholder="https://..."
                value={it.url} onChange={(e) => updateItem(it.id, { url: e.target.value })}
              />
            </label>

            <label className="nw-field">
              <span className="nw-label">Название</span>
              <input
                className="nw-input" type="text" placeholder="Например, кроссовки"
                value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })}
              />
            </label>

            <div className="nw-row">
              <label className="nw-field">
                <span className="nw-label">Кол-во</span>
                <input
                  className="nw-input" type="number" min="1" inputMode="numeric"
                  value={it.qty} onChange={(e) => updateItem(it.id, { qty: e.target.value })}
                />
              </label>
              <label className="nw-field">
                <span className="nw-label">Цена, $</span>
                <input
                  className="nw-input" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
                  value={it.price} onChange={(e) => updateItem(it.id, { price: e.target.value })}
                />
              </label>
            </div>
          </div>
        ))}

        <button type="button" className="nw-add" onClick={addItem}>
          <Plus size={16} /> Добавить товар
        </button>
      </section>

      <section className="nw-block">
        <div className="nw-block-head">
          <span className="nw-block-icon"><User size={15} /></span>
          <span className="nw-block-title">Получатель</span>
        </div>

        <label className="nw-field">
          <span className="nw-label">ФИО получателя</span>
          <input className="nw-input" type="text" placeholder="Иванов Иван" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        </label>
        <label className="nw-field">
          <span className="nw-label">Адрес доставки</span>
          <input className="nw-input" type="text" placeholder="Город, улица, дом" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="nw-field">
          <span className="nw-label">Телефон</span>
          <input className="nw-input" type="tel" inputMode="tel" placeholder="+7..." value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="nw-field">
          <span className="nw-label">Комментарий</span>
          <textarea className="nw-input nw-textarea" rows={3} placeholder="Пожелания к заказу" value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
      </section>

      <div className="nw-summary">
        <span className="nw-sum-label">Примерная сумма</span>
        <span className="nw-sum-value">$ {total.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      <button type="submit" className="nw-submit">Отправить заявку</button>

      <style>{`
        .nw { display: flex; flex-direction: column; gap: 16px; padding-bottom: 8px; }
        .nw-head { padding: 8px 4px 0; }
        .nw-title { margin: 0; font-family: var(--font-space-grotesk), sans-serif; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
        .nw-sub { margin: 4px 0 0; font-size: 13px; color: var(--cab-muted); }

        .nw-block {
          display: flex; flex-direction: column; gap: 14px; padding: 16px;
          border-radius: var(--cab-radius-md); background: var(--cab-surface);
          border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm);
        }
        .nw-block-head { display: flex; align-items: center; gap: 8px; }
        .nw-block-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 9px; color: var(--cab-green-deep);
          background: color-mix(in srgb, var(--cab-green) 13%, transparent);
        }
        .nw-block-title { font-size: 14px; font-weight: 700; }

        .nw-item {
          display: flex; flex-direction: column; gap: 11px; padding: 13px;
          border-radius: var(--cab-radius-sm); background: color-mix(in srgb, var(--cab-bg) 55%, var(--cab-surface));
          border: 1px solid var(--cab-border);
        }
        .nw-item-top { display: flex; align-items: center; justify-content: space-between; }
        .nw-item-n { font-size: 11.5px; font-weight: 700; color: var(--cab-muted); }
        .nw-item-del {
          display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;
          border-radius: 8px; border: 1px solid var(--cab-border); background: var(--cab-surface);
          color: var(--cab-muted); cursor: pointer; transition: color 0.15s, border-color 0.15s;
        }
        .nw-item-del:hover { color: var(--cab-danger); border-color: color-mix(in srgb, var(--cab-danger) 40%, transparent); }

        .nw-field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
        .nw-label { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: var(--cab-text-soft); }
        .nw-input {
          width: 100%; padding: 11px 12px; border-radius: 11px; font-size: 14px;
          color: var(--cab-text); background: var(--cab-surface);
          border: 1px solid var(--cab-border-strong); outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          font-family: inherit;
        }
        .nw-input::placeholder { color: color-mix(in srgb, var(--cab-muted) 75%, transparent); }
        .nw-input:focus { border-color: var(--cab-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--cab-green) 16%, transparent); }
        .nw-textarea { resize: vertical; line-height: 1.4; }
        .nw-row { display: flex; gap: 10px; }

        .nw-add {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          padding: 11px; border-radius: 11px; font-size: 13.5px; font-weight: 600; cursor: pointer;
          color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-green) 9%, transparent);
          border: 1px dashed color-mix(in srgb, var(--cab-green) 38%, transparent);
          transition: background 0.15s;
        }
        .nw-add:hover { background: color-mix(in srgb, var(--cab-green) 15%, transparent); }

        .nw-summary {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-radius: var(--cab-radius-md);
          background: color-mix(in srgb, var(--cab-green) 8%, var(--cab-surface));
          border: 1px solid color-mix(in srgb, var(--cab-green) 20%, var(--cab-border));
        }
        .nw-sum-label { font-size: 13px; font-weight: 600; color: var(--cab-text-soft); }
        .nw-sum-value { font-family: var(--font-space-grotesk), sans-serif; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--cab-green-deep); }

        .nw-submit {
          padding: 15px; border-radius: var(--cab-radius-md); border: none; cursor: pointer;
          font-size: 15px; font-weight: 700; color: #fff;
          background: linear-gradient(150deg, var(--cab-green) 0%, var(--cab-green-deep) 100%);
          box-shadow: 0 10px 24px color-mix(in srgb, var(--cab-green) 38%, transparent);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .nw-submit:hover { transform: translateY(-2px); box-shadow: 0 14px 30px color-mix(in srgb, var(--cab-green) 44%, transparent); }
        .nw-submit:active { transform: translateY(0); }

        @media (min-width: 1024px) {
          .nw { max-width: 640px; }
        }
      `}</style>
    </form>
  );
}

const doneStyles = `
  .nw-done {
    display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px;
    padding: 48px 24px; margin-top: 24px; border-radius: var(--cab-radius-lg);
    background:
      radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--cab-green) 16%, transparent) 0%, transparent 60%),
      var(--cab-surface);
    border: 1px solid color-mix(in srgb, var(--cab-green) 20%, var(--cab-border));
    box-shadow: var(--cab-shadow-md);
  }
  .nw-done-icon {
    display: inline-flex; align-items: center; justify-content: center; width: 72px; height: 72px;
    border-radius: 50%; color: #fff;
    background: linear-gradient(150deg, var(--cab-green), var(--cab-green-deep));
    box-shadow: 0 12px 28px color-mix(in srgb, var(--cab-green) 45%, transparent);
  }
  .nw-done-title { margin: 6px 0 0; font-family: var(--font-space-grotesk), sans-serif; font-size: 22px; font-weight: 700; }
  .nw-done-sub { margin: 0; font-size: 13.5px; color: var(--cab-muted); line-height: 1.5; max-width: 320px; }
  .nw-done-btn {
    margin-top: 8px; padding: 13px 28px; border-radius: var(--cab-radius-md);
    font-size: 14.5px; font-weight: 700; color: #fff; text-decoration: none;
    background: linear-gradient(150deg, var(--cab-green) 0%, var(--cab-green-deep) 100%);
    box-shadow: 0 10px 24px color-mix(in srgb, var(--cab-green) 38%, transparent);
  }
`;
