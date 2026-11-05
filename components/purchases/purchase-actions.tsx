"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { PurchaseLineStatus, PurchaseMode, PurchaseStatus } from "@prisma/client";
import { rejectPurchase, savePurchasePrice, setPurchaseDeleted, updatePurchaseNotes, type PurchaseActionResult } from "@/actions/purchases";
import { parseMoney, purchaseTotals, round2, yuan, type CommissionRule } from "@/lib/purchase-money";
import { MARKETPLACES } from "@/lib/purchase-lines";
import type { PurchaseFormOptions } from "@/lib/purchase-options";
import { ACTIONS_CSS } from "@/components/purchases/actions-css";

// Карточка покупки, справа: «Назначить цену» (шапка «под ключ» и цены строк), «Отказать (причина)», учёт, удаление.
// Кнопки строк («Выкуплено», «Вписать трек», отказ и возврат строки) — в таблице товаров (purchase-line-actions.tsx).

type Line = {
  id: string;
  lineNo: number;
  status: PurchaseLineStatus;
  productName: string;
  variant: string;
  quantity: number;
  unitPriceCny: number | null;
  chinaDeliveryCny: number | null;
  marketplace: string;
  seller: string;
};

type Props = {
  id: string;
  status: PurchaseStatus;
  deleted: boolean;
  isAdmin: boolean;
  hasOrders: boolean;
  paidNet: number;
  header: {
    mode: PurchaseMode;
    countryCode: string;
    recipientId: string;
    deliveryType: string;
    estimatedWeightKg: string;
    services: Record<string, boolean>;
    commissionManual: boolean;
    commissionCny: number | null;
  };
  lines: Line[];
  rule: CommissionRule;
  rejectReasons: string[];
  options: PurchaseFormOptions;
  internalComment: string;
};

const OTHER = "__other";
const str = (value: number | null) => (value == null ? "" : String(value));

export default function PurchaseActions(props: Props) {
  const { id, status, deleted, isAdmin, options } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [mode, setMode] = useState<PurchaseMode>(props.header.mode);
  const [country, setCountry] = useState(props.header.countryCode);
  const [deliveryType, setDeliveryType] = useState(props.header.deliveryType);
  const [rows, setRows] = useState(() =>
    props.lines.map((l) => ({ ...l, unitPriceCny: str(l.unitPriceCny), chinaDeliveryCny: str(l.chinaDeliveryCny ?? (l.unitPriceCny != null ? 0 : null)), quantity: String(l.quantity) }))
  );
  const [manual, setManual] = useState(props.header.commissionManual);
  const [commission, setCommission] = useState(str(props.header.commissionCny));
  const [reason, setReason] = useState(props.rejectReasons[0] ?? OTHER);

  const totals = purchaseTotals(
    rows.map((r) => ({ status: r.status, quantity: Number(r.quantity) || 0, unitPriceCny: parseMoney(r.unitPriceCny), chinaDeliveryCny: parseMoney(r.chinaDeliveryCny) })),
    { manual: manual ? parseMoney(commission) : null, rule: props.rule }
  );
  const paidStage = ["PAID", "PURCHASED", "AT_WAREHOUSE", "SHIPPED"].includes(status);
  const diff = paidStage && totals.totalCny != null ? round2(totals.totalCny - props.paidNet) : 0;
  const types = country ? options.typesByCountry[country] ?? [] : [];
  const recipients = options.recipients.filter((r) => !country || !r.countryCode || r.countryCode === country);

  function submit(name: string, action: () => Promise<PurchaseActionResult>, confirmText?: string) {
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
  const spin = (name: string) => (busy === name ? <Loader2 size={14} className="ba-spin" /> : null);
  const disabled = pending || !isAdmin;
  const setRow = (index: number, patch: Partial<(typeof rows)[number]>) => setRows((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const canPrice = ["NEW", "PRICED", "PAID", "PURCHASED"].includes(status) && rows.some((r) => r.status === "WAITING");
  const canReject = ["NEW", "PRICED", "PAID", "PURCHASED"].includes(status) && !props.hasOrders;
  const canDelete = ["NEW", "PRICED", "REJECTED", "CANCELED"].includes(status) && props.paidNet === 0;

  function onPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("lines", JSON.stringify(rows.filter((r) => r.status === "WAITING")));
    const confirmText = paidStage && diff !== 0 ? (diff > 0 ? `Клиенту нужно будет доплатить ${yuan(diff)}. Сохранить?` : `Клиенту вернётся ${yuan(-diff)}. Сохранить?`) : undefined;
    submit("price", () => savePurchasePrice(id, data), confirmText);
  }

  return (
    <div className="ba">
      {!isAdmin && <p className="ba-note">Действия с покупкой — у администратора.</p>}
      {deleted && <p className="ba-note">Покупка помечена на удаление.</p>}

      {canPrice && !deleted && (
        <form className="card card--pad ba-form" onSubmit={onPrice}>
          <h2 className="card-title">{status === "NEW" ? "Назначить цену" : "Изменить цену"}</h2>
          {paidStage && <p className="ba-hint">Клиент уже заплатил {yuan(props.paidNet)}. Меняются только строки, которые ещё не выкуплены: дороже — доплата, дешевле — разница вернётся сама.</p>}

          <div className="ba-row">
            <label className="ba-field">
              <span>Режим</span>
              <select name="mode" value={mode} onChange={(e) => setMode(e.target.value as PurchaseMode)} disabled={props.hasOrders}>
                <option value="TURNKEY">Под ключ</option>
                <option value="BUYOUT_ONLY">Только выкуп</option>
              </select>
            </label>
            <label className="ba-field ba-field--short">
              <span>Вес, кг</span>
              <input name="estimatedWeightKg" defaultValue={props.header.estimatedWeightKg} inputMode="decimal" placeholder="≈" />
            </label>
          </div>
          {mode === "TURNKEY" && (
            <>
              <div className="ba-row">
                <label className="ba-field">
                  <span>Страна</span>
                  <select name="countryCode" value={country} onChange={(e) => { setCountry(e.target.value); setDeliveryType((options.typesByCountry[e.target.value] ?? [])[0] ?? ""); }} disabled={props.hasOrders}>
                    <option value="">—</option>
                    {options.countries.map((c) => <option key={c.code} value={c.code}>{c.name}{c.withTariff ? "" : " (нет тарифа)"}</option>)}
                  </select>
                </label>
                <label className="ba-field">
                  <span>Доставка</span>
                  <select name="deliveryType" value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)} disabled={props.hasOrders}>
                    <option value="">—</option>
                    {options.deliveryMethods.map((m) => <option key={m.code} value={m.code}>{m.name}{types.length && !types.includes(m.code) ? " (нет тарифа)" : ""}</option>)}
                  </select>
                </label>
              </div>
              <label className="ba-field">
                <span>Получатель</span>
                <select name="recipientId" defaultValue={props.header.recipientId} disabled={props.hasOrders}>
                  <option value="">не выбран</option>
                  {recipients.map((r) => <option key={r.id} value={r.id}>{r.name}{r.city ? `, ${r.city}` : ""}</option>)}
                </select>
              </label>
            </>
          )}
          <div className="ba-services">
            {options.services.filter((s) => mode === "TURNKEY" || !s.turnkeyOnly).map((s) => (
              <label key={s.field} className="ba-check">
                <input type="checkbox" name={s.field} defaultChecked={props.header.services[s.field]} disabled={props.hasOrders} />
                {s.name} <span className="muted">{s.price}</span>
              </label>
            ))}
          </div>
          {props.hasOrders && <p className="ba-hint">По части строк уже есть заказы — доставку и услуги меняйте в заказах.</p>}

          <div className="ba-lines">
            {rows.map((row, index) => (
              <fieldset key={row.id} className="ba-line" disabled={row.status !== "WAITING"}>
                <legend>Строка {row.lineNo}{row.status !== "WAITING" ? " · выкуплена, цена закреплена" : ""}{row.status === "REJECTED" ? " · отказ" : ""}</legend>
                <input className="ba-in" value={row.productName} onChange={(e) => setRow(index, { productName: e.target.value })} placeholder="Товар" maxLength={200} />
                <div className="ba-row">
                  <input className="ba-in" value={row.variant} onChange={(e) => setRow(index, { variant: e.target.value })} placeholder="Вариант" maxLength={200} />
                  <select className="ba-in" value={row.marketplace} onChange={(e) => setRow(index, { marketplace: e.target.value })}>
                    {MARKETPLACES.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                  </select>
                </div>
                <input className="ba-in" value={row.seller} onChange={(e) => setRow(index, { seller: e.target.value })} placeholder="Продавец / магазин" maxLength={200} />
                <div className="ba-row">
                  <label className="ba-field"><span>Цена, ¥</span><input value={row.unitPriceCny} onChange={(e) => setRow(index, { unitPriceCny: e.target.value })} inputMode="decimal" /></label>
                  <label className="ba-field ba-field--short"><span>Кол-во</span><input value={row.quantity} onChange={(e) => setRow(index, { quantity: e.target.value })} inputMode="numeric" /></label>
                  <label className="ba-field"><span>По Китаю, ¥</span><input value={row.chinaDeliveryCny} onChange={(e) => setRow(index, { chinaDeliveryCny: e.target.value })} inputMode="decimal" placeholder="0" /></label>
                </div>
              </fieldset>
            ))}
          </div>

          <div className="ba-calc">
            <span>Товар: {yuan(totals.goodsCny)} · по Китаю: {yuan(totals.chinaDeliveryCny)}</span>
            <span>Комиссия по настройкам: {props.rule.percent != null ? `${props.rule.percent}%${props.rule.minCny ? `, не меньше ${yuan(props.rule.minCny)}` : ""}` : "процент не задан — «Настройки покупки»"}</span>
          </div>
          <label className="ba-check">
            <input type="checkbox" name="commissionManual" checked={manual} onChange={(e) => { setManual(e.target.checked); if (e.target.checked && !commission) setCommission(str(totals.commissionCny)); }} />
            Поправить комиссию вручную
          </label>
          {manual && <label className="ba-field"><span>Комиссия, ¥</span><input name="commissionCny" value={commission} onChange={(e) => setCommission(e.target.value)} inputMode="decimal" required /></label>}
          <p className="ba-total">
            К оплате: <b>{totals.totalCny != null ? yuan(totals.totalCny) : "—"}</b> <span className="muted">(комиссия {yuan(totals.commissionCny)})</span>
            {paidStage && diff !== 0 && <><br /><span className="muted">{diff > 0 ? `доплата ${yuan(diff)}` : `вернётся ${yuan(-diff)}`}</span></>}
          </p>
          {mode === "TURNKEY" && <p className="ba-hint">Ориентировочная доставка за границу посчитается при сохранении — по тарифу страны и вида доставки и примерному весу.</p>}
          <button type="submit" className="ba-btn ba-btn--primary" disabled={disabled || totals.totalCny == null || totals.missingPrice}>
            {spin("price")}{status === "NEW" ? "Назначить цену" : "Сохранить цену"}
          </button>
          {totals.missingPrice && <p className="ba-hint">Укажите цену у всех строк.</p>}
        </form>
      )}

      {canReject && !deleted && (
        <form
          className="card card--pad ba-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            submit("reject", () => rejectPurchase(id, data), props.paidNet > 0 ? `Отказать и вернуть клиенту ${yuan(props.paidNet)} на баланс?` : "Отказать клиенту?");
          }}
        >
          <h2 className="card-title">Отказать — вся покупка</h2>
          <label className="ba-field">
            <span>Причина</span>
            <select name={reason === OTHER ? undefined : "reason"} value={reason} onChange={(e) => setReason(e.target.value)}>
              {props.rejectReasons.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value={OTHER}>Другая причина…</option>
            </select>
          </label>
          <label className="ba-field"><span>{reason === OTHER ? "Причина" : "Пояснение (необязательно)"}</span><input name="reasonOther" maxLength={300} required={reason === OTHER} /></label>
          <button type="submit" className="ba-btn ba-btn--danger" disabled={disabled}>{spin("reject")}Отказать</button>
          <p className="ba-hint">
            {props.paidNet > 0 ? `Клиент заплатил ${yuan(props.paidNet)} — всё вернётся на баланс.` : "Клиент увидит причину в кабинете и в Telegram."} Отказать в одном товаре — в его строке.
          </p>
        </form>
      )}

      {!deleted && (
        <form
          className="card card--pad ba-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            submit("notes", () => updatePurchaseNotes(id, data));
          }}
        >
          <h2 className="card-title">Внутренний комментарий <span className="muted">· видят только сотрудники</span></h2>
          <textarea name="internalComment" defaultValue={props.internalComment} rows={3} maxLength={2000} className="ba-in" />
          <button type="submit" className="ba-btn" disabled={disabled}>{spin("notes")}Сохранить</button>
        </form>
      )}

      {canDelete && (
        <div className="ba-actions">
          <button type="button" className="ba-btn" disabled={disabled} onClick={() => submit("delete", () => setPurchaseDeleted(id, !deleted), deleted ? undefined : "Пометить покупку на удаление?")}>
            {spin("delete")}{deleted ? "Снять пометку удаления" : "Пометить на удаление"}
          </button>
        </div>
      )}

      {message && <p className={message.ok ? "ba-ok" : "ba-error"} role="status">{message.text}</p>}
      <style>{ACTIONS_CSS}</style>
    </div>
  );
}
