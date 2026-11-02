"use client";

import { useState, useTransition } from "react";
import { Link2, Loader2, MessageCircle } from "lucide-react";
import { createBuyoutRequest } from "@/actions/buyout-cabinet";
import FilePicker, { type PickedFile } from "./file-picker";

// Форма заявки на выкуп: «по ссылке» (Taobao / Tmall, 1688, Weidian и любые сайты) или «по контакту»
// (скриншот, QR-код или контакт продавца из WeChat). Условия сервиса — из настроек выкупа.

export default function BuyoutForm({ customerId, rulesText, maxFiles }: { customerId: string; rulesText: string | null; maxFiles: number }) {
  const [kind, setKind] = useState<"LINK" | "CONTACT">("LINK");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("kind", kind);
    data.set("attachments", JSON.stringify(files));
    setError(null);
    startTransition(async () => {
      const result = await createBuyoutRequest(data); // при успехе — переход к списку выкупов
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form className="bk-form" onSubmit={onSubmit}>
      <div className="bk-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={kind === "LINK"} className={`bk-tab ${kind === "LINK" ? "bk-tab--on" : ""}`} onClick={() => setKind("LINK")}>
          <Link2 size={15} style={{ verticalAlign: "-2px" }} /> По ссылке
        </button>
        <button type="button" role="tab" aria-selected={kind === "CONTACT"} className={`bk-tab ${kind === "CONTACT" ? "bk-tab--on" : ""}`} onClick={() => setKind("CONTACT")}>
          <MessageCircle size={15} style={{ verticalAlign: "-2px" }} /> По контакту
        </button>
      </div>

      {kind === "LINK" ? (
        <label className="bk-field">
          Ссылка на товар
          <textarea name="url" rows={3} required placeholder="Вставьте ссылку или весь текст из «Поделиться» — Taobao, Tmall, 1688, Weidian или другой сайт" />
        </label>
      ) : (
        <>
          <p className="bk-hint">Продавец в WeChat (朋友圈, 小程序)? Приложите скриншот товара, QR-код продавца или напишите его контакт — менеджер договорится и заплатит сам.</p>
          <label className="bk-field">
            Контакт продавца <small>WeChat ID, телефон или название магазина — если есть</small>
            <input name="sellerContact" maxLength={300} />
          </label>
        </>
      )}

      <div className="bk-field">
        {kind === "CONTACT" ? "Скриншот, QR-код" : "Скриншот товара"} <small>необязательно{kind === "CONTACT" ? ", если написали контакт" : ""} · до {maxFiles} картинок</small>
        <FilePicker customerId={customerId} value={files} onChange={setFiles} max={maxFiles} label="Добавить" onError={setError} />
      </div>

      <label className="bk-field">
        Что за товар
        <input name="productName" required maxLength={200} placeholder="Кроссовки, чехол для телефона…" />
      </label>
      <div className="bk-row">
        <label className="bk-field">
          Вариант <small>размер, цвет</small>
          <input name="variant" maxLength={200} placeholder="42, белые" />
        </label>
        <label className="bk-field bk-qty">
          Кол-во
          <input name="quantity" type="number" min={1} max={999} defaultValue={1} required />
        </label>
      </div>
      <label className="bk-field">
        Комментарий <small>необязательно</small>
        <textarea name="customerComment" rows={2} maxLength={1000} />
      </label>

      {rulesText && <p className="bk-info">{rulesText}</p>}
      {error && <p className="bk-error" role="alert">{error}</p>}

      <button type="submit" className="bk-btn bk-btn--primary" disabled={pending}>
        {pending ? <Loader2 size={16} className="bk-spin" /> : null}
        Отправить заявку
      </button>
      <p className="bk-hint">Цену назовём в ¥: товар + доставка по Китаю до склада + комиссия. Оплата — с баланса после того, как цена назначена.</p>
    </form>
  );
}
