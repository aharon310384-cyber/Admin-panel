"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Link2, Loader2, MessageCircle, Plus } from "lucide-react";
import { createPurchase, estimateCart, type CartEstimate } from "@/actions/purchase-cabinet";
import { yuan } from "@/lib/purchase-money";
import type { PurchaseFormOptions } from "@/lib/purchase-options";
import FilePicker, { type PickedFile } from "./file-picker";

// «Хочу купить» (docs/product/задание-выкуп.md, раздел 9): корзина — ссылка или скриншот, вариант, количество;
// страна и получатель; ориентировочная цена по частям. Расчёт — на сервере по тарифам из базы, ничего не сохраняет.

type CartLine = {
  key: number;
  kind: "LINK" | "CONTACT";
  url: string;
  sellerContact: string;
  attachments: PickedFile[];
  productName: string;
  variant: string;
  quantity: string;
  unitPriceCny: string;
};

const emptyLine = (key: number): CartLine => ({ key, kind: "LINK", url: "", sellerContact: "", attachments: [], productName: "", variant: "", quantity: "1", unitPriceCny: "" });

type Props = {
  customerId: string;
  rulesText: string | null;
  maxFiles: number;
  options: PurchaseFormOptions;
  allowBuyoutOnly: boolean;
  commissionText: string | null;
};

export default function PurchaseForm({ customerId, rulesText, maxFiles, options, allowBuyoutOnly, commissionText }: Props) {
  const [lines, setLines] = useState<CartLine[]>([emptyLine(1)]);
  const [mode, setMode] = useState<"TURNKEY" | "BUYOUT_ONLY">("TURNKEY");
  const [country, setCountry] = useState("");
  const [deliveryType, setDeliveryType] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [weight, setWeight] = useState("");
  const [services, setServices] = useState<Record<string, boolean>>({ keepOriginalPackaging: true });
  const [estimate, setEstimate] = useState<CartEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextKey = useRef(2);

  const turnkey = mode === "TURNKEY";
  const types = country ? options.typesByCountry[country] ?? [] : [];
  const recipients = options.recipients.filter((r) => !country || !r.countryCode || r.countryCode === country);
  const setLine = (key: number, patch: Partial<CartLine>) => setLines((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // ориентировочная цена — через полсекунды после последнего изменения
  const estimateKey = JSON.stringify({ mode, country, deliveryType, weight, services, lines: lines.map((l) => [l.quantity, l.unitPriceCny]) });
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      setEstimating(true);
      try {
        const result = await estimateCart({
          mode,
          countryCode: country,
          deliveryType,
          weightKg: weight,
          lines: lines.map((l) => ({ quantity: Number(l.quantity) || 1, unitPriceCny: l.unitPriceCny })),
          services,
        });
        if (alive) setEstimate(result);
      } catch {
        if (alive) setEstimate(null);
      } finally {
        if (alive) setEstimating(false);
      }
    }, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчёт по снимку полей корзины
  }, [estimateKey]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData();
    data.set("mode", mode);
    data.set("countryCode", turnkey ? country : "");
    data.set("deliveryType", turnkey ? deliveryType : "");
    data.set("recipientId", turnkey ? recipientId : "");
    data.set("estimatedWeightKg", weight);
    data.set("customerComment", String(new FormData(event.currentTarget).get("customerComment") ?? ""));
    for (const [field, on] of Object.entries(services)) if (on) data.set(field, "on");
    data.set("lines", JSON.stringify(lines.map((line) => ({ kind: line.kind, url: line.url, sellerContact: line.sellerContact, attachments: line.attachments, productName: line.productName, variant: line.variant, quantity: line.quantity, unitPriceCny: line.unitPriceCny }))));
    setError(null);
    startTransition(async () => {
      const result = await createPurchase(data); // при успехе — переход к «Мои покупки»
      if (result && !result.ok) setError(result.error);
    });
  }

  const est = estimate?.estimate;
  return (
    <form className="bk-form" onSubmit={onSubmit}>
      <h2 className="bk-h2" style={{ margin: 0 }}>Что купить</h2>
      {lines.map((line, index) => (
        <div key={line.key} className="pc-line">
          <div className="pc-line-head">
            <b>Товар {index + 1}</b>
            {lines.length > 1 && <button type="button" className="pc-remove" onClick={() => setLines((list) => list.filter((l) => l.key !== line.key))}>Убрать</button>}
          </div>
          <div className="bk-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={line.kind === "LINK"} className={`bk-tab ${line.kind === "LINK" ? "bk-tab--on" : ""}`} onClick={() => setLine(line.key, { kind: "LINK" })}>
              <Link2 size={15} style={{ verticalAlign: "-2px" }} /> Ссылка
            </button>
            <button type="button" role="tab" aria-selected={line.kind === "CONTACT"} className={`bk-tab ${line.kind === "CONTACT" ? "bk-tab--on" : ""}`} onClick={() => setLine(line.key, { kind: "CONTACT" })}>
              <MessageCircle size={15} style={{ verticalAlign: "-2px" }} /> Продавец в WeChat
            </button>
          </div>
          {line.kind === "LINK" ? (
            <label className="bk-field">
              Ссылка <small>Taobao, Tmall, 1688, Weidian или любой сайт — можно весь текст из «Поделиться»</small>
              <textarea rows={2} value={line.url} onChange={(e) => setLine(line.key, { url: e.target.value })} required />
            </label>
          ) : (
            <label className="bk-field">
              Контакт продавца <small>WeChat ID, телефон, магазин — или приложите скриншот / QR-код ниже</small>
              <input value={line.sellerContact} onChange={(e) => setLine(line.key, { sellerContact: e.target.value })} maxLength={300} />
            </label>
          )}
          <div className="bk-field">
            {line.kind === "CONTACT" ? "Скриншот, QR-код" : "Скриншот товара"} <small>необязательно · до {maxFiles}</small>
            <FilePicker customerId={customerId} value={line.attachments} onChange={(files) => setLine(line.key, { attachments: files })} max={maxFiles} label="Добавить" onError={setError} />
          </div>
          <label className="bk-field">
            Что за товар
            <input value={line.productName} onChange={(e) => setLine(line.key, { productName: e.target.value })} required maxLength={200} placeholder="Кроссовки, чехол…" />
          </label>
          <div className="bk-row">
            <label className="bk-field">
              Вариант <small>размер, цвет</small>
              <input value={line.variant} onChange={(e) => setLine(line.key, { variant: e.target.value })} maxLength={200} />
            </label>
            <label className="bk-field bk-qty">
              Кол-во
              <input type="number" min={1} max={999} value={line.quantity} onChange={(e) => setLine(line.key, { quantity: e.target.value })} required />
            </label>
          </div>
          <label className="bk-field">
            Цена за штуку, ¥ <small>если знаете — для ориентировочного расчёта; точную назовёт менеджер</small>
            <input inputMode="decimal" value={line.unitPriceCny} onChange={(e) => setLine(line.key, { unitPriceCny: e.target.value })} placeholder="например, 199" />
          </label>
        </div>
      ))}
      {lines.length < 20 && (
        <button type="button" className="bk-btn bk-btn--small pc-add" onClick={() => setLines((list) => [...list, emptyLine(nextKey.current++)])}>
          <Plus size={15} /> Ещё товар
        </button>
      )}

      <h2 className="bk-h2" style={{ margin: "6px 0 0" }}>Куда доставить</h2>
      {allowBuyoutOnly && (
        <div className="pc-modes">
          <label className={`pc-mode ${turnkey ? "pc-mode--on" : ""}`}>
            <input type="radio" checked={turnkey} onChange={() => setMode("TURNKEY")} />
            <span><b>Под ключ</b><small>купим, проверим и отправим вам</small></span>
          </label>
          <label className={`pc-mode ${!turnkey ? "pc-mode--on" : ""}`}>
            <input type="radio" checked={!turnkey} onChange={() => setMode("BUYOUT_ONLY")} />
            <span><b>Только выкуп</b><small>купим и примем на склад, посылку оформите сами</small></span>
          </label>
        </div>
      )}
      {turnkey && (
        <>
          <div className="bk-row">
            <label className="bk-field">
              Страна
              <select value={country} required onChange={(e) => { setCountry(e.target.value); setDeliveryType((options.typesByCountry[e.target.value] ?? [])[0] ?? ""); setRecipientId(""); }}>
                <option value="" disabled>Выберите</option>
                {options.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <label className="bk-field">
              Доставка
              <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
                <option value="">{types.length ? "Выберите" : "подберёт менеджер"}</option>
                {options.deliveryMethods.filter((m) => !types.length || types.includes(m.code)).map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <label className="bk-field">
            Получатель <small>{options.recipients.length ? "из ваших получателей" : "получателей пока нет — менеджер уточнит"}</small>
            <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
              <option value="">{recipients.length ? "Выберите" : "уточнит менеджер"}</option>
              {recipients.map((r) => <option key={r.id} value={r.id}>{r.name}{r.city ? `, ${r.city}` : ""}</option>)}
            </select>
          </label>
          <label className="bk-field">
            Примерный вес всего, кг <small>для расчёта доставки; точный — после взвешивания</small>
            <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="например, 1.5" />
          </label>
        </>
      )}
      {options.services.length > 0 && (
        <div className="bk-field">
          Услуги склада <small>необязательно</small>
          <div className="pc-services">
            {options.services.filter((s) => turnkey || !s.turnkeyOnly).map((s) => (
              <label key={s.field} className="pc-check">
                <input type="checkbox" checked={Boolean(services[s.field])} onChange={(e) => setServices((all) => ({ ...all, [s.field]: e.target.checked }))} />
                {s.name} <small>{s.price}</small>
              </label>
            ))}
          </div>
        </div>
      )}
      <label className="bk-field">
        Комментарий <small>необязательно</small>
        <textarea name="customerComment" rows={2} maxLength={1000} />
      </label>

      <div className="bk-card" style={{ boxShadow: "none" }}>
        <b>Ориентировочная цена {estimating && <Loader2 size={13} className="bk-spin" style={{ verticalAlign: "-2px" }} />}</b>
        <div className="pc-est">
          <span>Товар</span>
          <span>{estimate && estimate.goodsCny > 0 ? `${estimate.goodsKnown ? "" : "от "}${yuan(estimate.goodsCny)}` : "назовёт менеджер"}</span>
          <span>Доставка по Китаю до склада</span><span>назовёт менеджер</span>
          <span>Комиссия</span>
          <span>{estimate?.commissionCny != null && estimate.goodsCny > 0 ? yuan(estimate.commissionCny) : "—"}</span>
          {commissionText && <span className="pc-sub">{commissionText}</span>}
          {turnkey && (
            <>
              <span className="pc-approx">Доставка за границу — ориентировочно</span>
              <span className="pc-approx">{est?.shippingCny != null ? yuan(est.shippingCny) : "—"}</span>
              <span className="pc-sub">{est?.shippingNote ?? "выберите страну"}{est?.days ? ` · срок ${est.days}` : ""}</span>
              {est?.services.map((s) => (
                <span key={s.name} style={{ display: "contents" }}>
                  <span className="pc-approx">{s.name}</span>
                  <span className="pc-approx">{s.cny != null ? yuan(s.cny) : s.note ?? "—"}</span>
                </span>
              ))}
              {est?.dutyNote && (
                <>
                  <span className="pc-approx">Возможная пошлина</span>
                  <span className="pc-approx">{est.dutyCny != null ? yuan(est.dutyCny) : "—"}</span>
                  <span className="pc-sub">{est.dutyNote}</span>
                </>
              )}
            </>
          )}
        </div>
        <p className="bk-hint" style={{ margin: 0 }}>
          Это не окончательная цена. За покупку (товар, доставка по Китаю, комиссия) платите после того, как менеджер назовёт цену.
          {turnkey ? " Доставку за границу — после взвешивания посылки." : ""}
        </p>
      </div>

      {rulesText && <p className="bk-info">{rulesText}</p>}
      {error && <p className="bk-error" role="alert">{error}</p>}

      <button type="submit" className="bk-btn bk-btn--primary" disabled={pending}>
        {pending ? <Loader2 size={16} className="bk-spin" /> : null}
        Отправить заявку
      </button>
    </form>
  );
}
