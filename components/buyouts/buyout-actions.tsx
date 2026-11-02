"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { BuyoutStatus } from "@prisma/client";
import {
  markBuyoutPurchased,
  rejectBuyout,
  returnBuyout,
  setBuyoutDeleted,
  setBuyoutPrice,
  setBuyoutTrack,
  updateBuyoutNotes,
  type BuyoutActionResult,
} from "@/actions/buyouts";
import { buyoutTotals, commissionFor, parseMoney, round2, yuan, type CommissionRule } from "@/lib/buyout-money";

// Кнопки карточки выкупа по статусу (docs/product/задание-выкуп.md, раздел 5):
// «Назначить цену», «Выкуплено», «Вписать трек», «Отказать (причина)», «Возврат»; ниже — учёт и пометка удаления.

type Props = {
  id: string;
  status: BuyoutStatus;
  deleted: boolean;
  isAdmin: boolean;
  hasOrder: boolean;
  orderLocked: boolean;
  price: {
    productName: string;
    variant: string;
    quantity: number;
    unitPriceCny: number | null;
    chinaDeliveryCny: number | null;
    commissionCny: number | null;
    commissionManual: boolean;
  };
  money: { total: number | null; goods: number | null; commission: number | null; paidNet: number };
  rule: CommissionRule;
  rejectReasons: string[];
  sellerTrack: string;
  notes: { internalComment: string; paidToSellerCny: string; photoUrl: string };
};

const OTHER = "__other";
const str = (value: number | null) => (value == null ? "" : String(value));

export default function BuyoutActions(props: Props) {
  const { id, status, deleted, isAdmin, rule } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // цена
  const [productName, setProductName] = useState(props.price.productName);
  const [variant, setVariant] = useState(props.price.variant);
  const [quantity, setQuantity] = useState(String(props.price.quantity));
  const [unitPrice, setUnitPrice] = useState(str(props.price.unitPriceCny));
  const [delivery, setDelivery] = useState(str(props.price.chinaDeliveryCny ?? (props.price.unitPriceCny != null ? 0 : null)));
  const [manual, setManual] = useState(props.price.commissionManual);
  const [commission, setCommission] = useState(str(props.price.commissionCny));
  // отказ и возврат
  const [reason, setReason] = useState(props.rejectReasons[0] ?? OTHER);
  const [returnKind, setReturnKind] = useState<"SELLER" | "CLIENT" | "">("");
  const [returnCost, setReturnCost] = useState("");
  const [refund, setRefund] = useState("");
  // учёт
  const [photoUrl, setPhotoUrl] = useState(props.notes.photoUrl);
  const [uploading, setUploading] = useState(false);

  const unit = parseMoney(unitPrice) ?? 0;
  const qty = Number(quantity) || 0;
  const goods = round2(unit * qty);
  const autoCommission = commissionFor(goods, rule);
  const usedCommission = manual ? parseMoney(commission) : autoCommission;
  const preview = usedCommission != null ? buyoutTotals({ unitPriceCny: unit, quantity: qty, chinaDeliveryCny: parseMoney(delivery) ?? 0, commissionCny: usedCommission }) : null;

  const paid = props.money.paidNet;
  const suggestedRefund = (kind: "SELLER" | "CLIENT", cost: number) =>
    kind === "SELLER" ? paid : Math.max(0, round2(Math.min(paid, props.money.goods ?? 0) - cost));

  function submit(name: string, action: () => Promise<BuyoutActionResult>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(name);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        setMessage(result.ok ? { ok: true, text: result.message ?? "Готово" } : { ok: false, text: result.error });
        if (result.ok) router.refresh();
      } catch (error) {
        setMessage({ ok: false, text: error instanceof Error && error.message === "Нет доступа" ? "Нет доступа: действия — у администратора" : "Не получилось — попробуйте ещё раз" });
      } finally {
        setBusy(null);
      }
    });
  }
  const formAction = (name: string, action: (id: string, data: FormData) => Promise<BuyoutActionResult>, confirmText?: string) =>
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      submit(name, () => action(id, data), confirmText);
    };
  const spin = (name: string) => (busy === name ? <Loader2 size={14} className="ba-spin" /> : null);
  const disabled = pending || !isAdmin;

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) setPhotoUrl(data.url);
      else setMessage({ ok: false, text: data.error ?? "Не загрузилось" });
    } catch {
      setMessage({ ok: false, text: "Не загрузилось" });
    } finally {
      setUploading(false);
    }
  }

  const canPrice = status === "NEW" || status === "PRICED";
  const canReject = ["NEW", "PRICED", "PAID", "PURCHASED"].includes(status);
  const canReturn = ["PURCHASED", "SHIPPED", "AT_WAREHOUSE"].includes(status);
  const canDelete = ["NEW", "PRICED", "REJECTED", "CANCELED"].includes(status);

  return (
    <div className="ba">
      {!isAdmin && <p className="ba-note">Действия с выкупом — у администратора.</p>}
      {deleted && <p className="ba-note">Выкуп помечен на удаление.</p>}

      {canPrice && !deleted && (
        <form className="card card--pad ba-form" onSubmit={formAction("price", setBuyoutPrice)}>
          <h2 className="card-title">{status === "PRICED" ? "Изменить цену" : "Назначить цену"}</h2>
          <label className="ba-field"><span>Товар</span><input name="productName" value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={200} required /></label>
          <label className="ba-field"><span>Вариант (размер, цвет)</span><input name="variant" value={variant} onChange={(e) => setVariant(e.target.value)} maxLength={200} /></label>
          <div className="ba-row">
            <label className="ba-field"><span>Цена за шт., ¥</span><input name="unitPriceCny" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" required /></label>
            <label className="ba-field ba-field--short"><span>Кол-во</span><input name="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" required /></label>
          </div>
          <label className="ba-field"><span>Доставка по Китаю до склада, ¥</span><input name="chinaDeliveryCny" value={delivery} onChange={(e) => setDelivery(e.target.value)} inputMode="decimal" placeholder="0" /></label>
          <div className="ba-calc">
            <span>Товар: {yuan(goods)}</span>
            <span>
              Комиссия по настройкам:{" "}
              {autoCommission != null ? `${yuan(autoCommission)} (${rule.percent}%${rule.minCny ? `, не меньше ${yuan(rule.minCny)}` : ""})` : "процент не задан — «Настройки выкупа»"}
            </span>
          </div>
          <label className="ba-check">
            <input type="checkbox" name="commissionManual" checked={manual} onChange={(e) => { setManual(e.target.checked); if (e.target.checked && !commission) setCommission(str(autoCommission)); }} />
            Поправить комиссию вручную
          </label>
          {manual && <label className="ba-field"><span>Комиссия, ¥</span><input name="commissionCny" value={commission} onChange={(e) => setCommission(e.target.value)} inputMode="decimal" required /></label>}
          <p className="ba-total">Итого клиенту: <b>{preview ? yuan(preview.totalCny) : "—"}</b></p>
          <button type="submit" className="ba-btn ba-btn--primary" disabled={disabled || !preview}>{spin("price")}{status === "PRICED" ? "Сохранить новую цену" : "Назначить цену"}</button>
          <p className="ba-hint">Клиенту придёт сообщение с ценой, в кабинете появится «Оплатить с баланса».</p>
        </form>
      )}

      {status === "PAID" && !deleted && (
        <form className="card card--pad ba-form" onSubmit={formAction("purchased", markBuyoutPurchased)}>
          <h2 className="card-title">Выкуплено</h2>
          <p className="ba-hint">Клиент оплатил {props.money.total != null ? yuan(props.money.total) : ""}. Купите товар и отметьте.</p>
          <label className="ba-field"><span>Фактически заплачено продавцу, ¥</span><input name="paidToSellerCny" defaultValue={props.notes.paidToSellerCny} inputMode="decimal" placeholder="для учёта нашей разницы" /></label>
          <button type="submit" className="ba-btn ba-btn--primary" disabled={disabled}>{spin("purchased")}Выкуплено</button>
        </form>
      )}

      {(status === "PURCHASED" || (status === "SHIPPED" && !props.orderLocked)) && !deleted && (
        <form className="card card--pad ba-form" onSubmit={formAction("track", setBuyoutTrack)}>
          <h2 className="card-title">{status === "PURCHASED" ? "Вписать трек продавца" : "Исправить трек продавца"}</h2>
          <label className="ba-field"><span>Трек-номер (SF, YTO, ZTO, J&T…)</span><input name="sellerTrack" defaultValue={props.sellerTrack} required className="ba-mono" /></label>
          <button type="submit" className="ba-btn ba-btn--primary" disabled={disabled}>{spin("track")}{status === "PURCHASED" ? "Вписать трек и создать заказ" : "Исправить трек"}</button>
          <p className="ba-hint">
            {status === "PURCHASED"
              ? "Программа создаст заказ ZK-… с товаром, ценой, ссылкой, фото и треком — дальше обычный путь склада."
              : "Трек поменяется и в заказе."}
          </p>
        </form>
      )}

      {canReject && !deleted && (
        <form className="card card--pad ba-form" onSubmit={formAction("reject", rejectBuyout, paid > 0 ? `Отказать и вернуть клиенту ${yuan(paid)} на баланс?` : "Отказать клиенту?")}>
          <h2 className="card-title">Отказать</h2>
          <label className="ba-field">
            <span>Причина</span>
            <select name={reason === OTHER ? undefined : "reason"} value={reason} onChange={(e) => setReason(e.target.value)}>
              {props.rejectReasons.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value={OTHER}>Другая причина…</option>
            </select>
          </label>
          <label className="ba-field"><span>{reason === OTHER ? "Причина" : "Пояснение (необязательно)"}</span><input name="reasonOther" maxLength={300} required={reason === OTHER} /></label>
          <button type="submit" className="ba-btn ba-btn--danger" disabled={disabled}>{spin("reject")}Отказать</button>
          <p className="ba-hint">{paid > 0 ? `Клиент уже заплатил — ${yuan(paid)} вернутся на баланс обратной записью.` : "Клиент увидит причину в кабинете и в Telegram."}</p>
        </form>
      )}

      {canReturn && !deleted && (
        <form className="card card--pad ba-form" onSubmit={formAction("return", returnBuyout, `Оформить возврат и вернуть ${refund || "0"} ¥ на баланс клиента?`)}>
          <h2 className="card-title">Возврат</h2>
          <label className="ba-check">
            <input type="radio" name="returnKind" value="SELLER" checked={returnKind === "SELLER"} onChange={() => { setReturnKind("SELLER"); setRefund(String(suggestedRefund("SELLER", parseMoney(returnCost) ?? 0))); }} />
            Брак или не тот товар — за счёт продавца
          </label>
          <label className="ba-check">
            <input type="radio" name="returnKind" value="CLIENT" checked={returnKind === "CLIENT"} onChange={() => { setReturnKind("CLIENT"); setRefund(String(suggestedRefund("CLIENT", parseMoney(returnCost) ?? 0))); }} />
            Клиент передумал — за счёт клиента
          </label>
          {returnKind === "CLIENT" && (
            <label className="ba-field">
              <span>Доставка продавцу, ¥</span>
              <input name="returnCostCny" value={returnCost} inputMode="decimal" onChange={(e) => { setReturnCost(e.target.value); setRefund(String(suggestedRefund("CLIENT", parseMoney(e.target.value) ?? 0))); }} />
            </label>
          )}
          <label className="ba-field"><span>Вернуть на баланс, ¥</span><input name="refundCny" value={refund} onChange={(e) => setRefund(e.target.value)} inputMode="decimal" required /></label>
          <label className="ba-field"><span>Пояснение</span><input name="note" maxLength={300} /></label>
          <button type="submit" className="ba-btn ba-btn--danger" disabled={disabled || !returnKind}>{spin("return")}Оформить возврат</button>
          <p className="ba-hint">
            Клиент заплатил {yuan(paid)}. За счёт продавца — всё назад; за счёт клиента — товар минус доставка продавцу (комиссия и доставка по Китаю не возвращаются).
            {props.hasOrder ? " Заказ из выкупа получит статус «Возвращён»." : ""}
          </p>
        </form>
      )}

      {!deleted && (
        <form className="card card--pad ba-form" onSubmit={formAction("notes", updateBuyoutNotes)}>
          <h2 className="card-title">Учёт <span className="muted">· видят только сотрудники</span></h2>
          <label className="ba-field"><span>Внутренний комментарий</span><textarea name="internalComment" defaultValue={props.notes.internalComment} rows={3} maxLength={2000} /></label>
          <label className="ba-field"><span>Фактически заплачено продавцу, ¥</span><input name="paidToSellerCny" defaultValue={props.notes.paidToSellerCny} inputMode="decimal" /></label>
          <div className="ba-field">
            <span>Фото товара (переходит в заказ)</span>
            <input type="hidden" name="photoUrl" value={photoUrl} />
            <div className="ba-photo">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- превью загруженного фото
                <img src={photoUrl} alt="" />
              ) : null}
              <label className="ba-btn">
                {uploading ? <Loader2 size={14} className="ba-spin" /> : null}
                {photoUrl ? "Заменить" : "Загрузить"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden disabled={disabled || uploading} onChange={(e) => uploadPhoto(e.target.files?.[0])} />
              </label>
              {photoUrl && <button type="button" className="ba-btn" onClick={() => setPhotoUrl("")} disabled={disabled}>Убрать</button>}
            </div>
          </div>
          <button type="submit" className="ba-btn" disabled={disabled || uploading}>{spin("notes")}Сохранить</button>
        </form>
      )}

      {canDelete && (
        <div className="ba-actions">
          <button
            type="button"
            className="ba-btn"
            disabled={disabled}
            onClick={() => submit("delete", () => setBuyoutDeleted(id, !deleted), deleted ? undefined : "Пометить выкуп на удаление?")}
          >
            {spin("delete")}{deleted ? "Снять пометку удаления" : "Пометить на удаление"}
          </button>
        </div>
      )}

      {message && <p className={message.ok ? "ba-ok" : "ba-error"} role="status">{message.text}</p>}

      <style>{`
        .ba { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 8px; }
        .ba-form { display: flex; flex-direction: column; gap: 8px; }
        .ba-form .card-title { margin: 0 0 2px; }
        .ba-row { display: flex; gap: 8px; }
        .ba-row .ba-field { flex: 1; }
        .ba-field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; }
        .ba-field > span { color: var(--color-muted); }
        .ba-field--short { flex: 0 0 90px !important; }
        .ba-field input, .ba-field select, .ba-field textarea { padding: 7px 9px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font: inherit; font-size: 13.5px; background: var(--color-surface); color: var(--color-text); outline: none; }
        .ba-field input:focus, .ba-field select:focus, .ba-field textarea:focus { border-color: var(--color-accent); }
        .ba-mono { font-family: var(--font-mono); }
        .ba-check { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
        .ba-calc { display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; color: var(--color-text-secondary); }
        .ba-total { margin: 2px 0; font-size: 14px; }
        .ba-hint { margin: 0; font-size: 12px; color: var(--color-muted); line-height: 1.45; }
        .ba-note { margin: 0; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--color-muted-bg); color: var(--color-text-secondary); font-size: 13px; }
        .ba-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .ba-photo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ba-photo img { width: 64px; height: 64px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--color-border); }
        .ba-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; }
        .ba-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
        .ba-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .ba-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-fg); }
        .ba-btn--primary:hover:not(:disabled) { background: var(--color-accent-hover); }
        .ba-btn--danger { color: var(--color-danger); }
        .ba-ok, .ba-error { margin: 0; padding: 8px 10px; border-radius: var(--radius-sm); line-height: 1.45; font-size: 13px; }
        .ba-ok { color: var(--color-success); background: var(--color-success-bg); }
        .ba-error { color: var(--color-danger); background: var(--color-warning-bg); }
        .ba-spin { animation: ba-spin 0.8s linear infinite; }
        @keyframes ba-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
