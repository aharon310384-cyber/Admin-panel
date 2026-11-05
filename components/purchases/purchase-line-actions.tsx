"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { PurchaseLineStatus } from "@prisma/client";
import { markLinePurchased, rejectLine, returnLine, setLineTrack, updateLineNotes, type PurchaseActionResult } from "@/actions/purchases";
import { parseMoney, round2, yuan } from "@/lib/purchase-money";
import { ACTIONS_CSS } from "@/components/purchases/actions-css";

// Кнопки строки покупки: «Выкуплено», «Вписать трек» (создаёт заказ ZK-…), «Отказать», «Возврат», учёт строки.
// Продавцы отправляют в разное время — поэтому у каждой строки свой шаг.

type Props = {
  purchaseId: string;
  line: {
    id: string;
    lineNo: number;
    status: PurchaseLineStatus;
    sellerTrack: string;
    sellerOrderNo: string;
    paidToSellerCny: string;
    photoUrl: string;
    goodsCny: number;
    costCny: number; // стоимость строки для клиента: товар + по Китаю + доля комиссии
    hasOrder: boolean;
    orderLocked: boolean;
  };
  paid: boolean; // клиент оплатил (и доплатил) — можно покупать
  rejectReasons: string[];
  isAdmin: boolean;
};

const OTHER = "__other";

export default function PurchaseLineActions({ purchaseId, line, paid, rejectReasons, isAdmin }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [reason, setReason] = useState(rejectReasons[0] ?? OTHER);
  const [returnKind, setReturnKind] = useState<"SELLER" | "CLIENT" | "">("");
  const [returnCost, setReturnCost] = useState("");
  const [refund, setRefund] = useState("");
  const [photoUrl, setPhotoUrl] = useState(line.photoUrl);
  const [uploading, setUploading] = useState(false);

  const suggest = (kind: "SELLER" | "CLIENT", cost: number) => String(kind === "SELLER" ? line.costCny : Math.max(0, round2(line.goodsCny - cost)));

  const handle = (name: string, action: (data: FormData) => Promise<PurchaseActionResult>, confirmText?: string) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(name);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action(data);
        setMessage(result.ok ? { ok: true, text: result.message ?? "Готово" } : { ok: false, text: result.error });
        if (result.ok) router.refresh();
      } catch {
        setMessage({ ok: false, text: "Не получилось — проверьте права и попробуйте ещё раз" });
      } finally {
        setBusy(null);
      }
    });
  };
  const spin = (name: string) => (busy === name ? <Loader2 size={13} className="ba-spin" /> : null);
  const disabled = pending || !isAdmin;

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
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

  const s = line.status;
  // строка закрылась (отказ, возврат) — кнопок нет, но итог действия остаётся виден
  if (s === "REJECTED" || s === "RETURNED") {
    return message ? <p className={message.ok ? "ba-ok" : "ba-error"} role="status" style={{ fontSize: 12.5 }}>{message.text}<style>{ACTIONS_CSS}</style></p> : null;
  }
  const label = s === "WAITING" ? (paid ? "Выкуплено…" : "Действия") : s === "PURCHASED" ? "Вписать трек…" : "Действия";

  return (
    <details className="pl-act">
      <summary>{label}</summary>
      <div className="ba" style={{ minWidth: 240 }}>
        {s === "WAITING" && paid && (
          <form className="ba-form" onSubmit={handle("buy", (d) => markLinePurchased(purchaseId, line.id, d))}>
            <b>Выкуплено</b>
            <label className="ba-field"><span>Заплачено продавцу, ¥</span><input name="paidToSellerCny" defaultValue={line.paidToSellerCny} inputMode="decimal" /></label>
            <label className="ba-field"><span>Номер заказа у продавца</span><input name="sellerOrderNo" defaultValue={line.sellerOrderNo} maxLength={80} /></label>
            <button type="submit" className="ba-btn ba-btn--primary" disabled={disabled}>{spin("buy")}Выкуплено</button>
          </form>
        )}
        {s === "WAITING" && !paid && <p className="ba-hint">Покупать — после оплаты (и доплаты) клиента.</p>}

        {(s === "PURCHASED" || (s === "SHIPPED" && !line.orderLocked)) && (
          <form className="ba-form" onSubmit={handle("track", (d) => setLineTrack(purchaseId, line.id, d))}>
            <b>{s === "PURCHASED" ? "Трек продавца" : "Исправить трек"}</b>
            <input name="sellerTrack" defaultValue={line.sellerTrack} required className="ba-in ba-mono" placeholder="SF, YTO, ZTO, J&T…" />
            <button type="submit" className="ba-btn ba-btn--primary" disabled={disabled}>{spin("track")}{s === "PURCHASED" ? "Вписать трек и создать заказ" : "Исправить трек"}</button>
            {s === "PURCHASED" && <p className="ba-hint">Тот же трек, что у другой строки, — одна коробка: заказы с одним треком.</p>}
          </form>
        )}

        {(s === "WAITING" || s === "PURCHASED") && !line.hasOrder && (
          <form className="ba-form" onSubmit={handle("reject", (d) => rejectLine(purchaseId, line.id, d), `Отказать по строке ${line.lineNo}?`)}>
            <b>Отказать по строке</b>
            <select name={reason === OTHER ? undefined : "reason"} value={reason} onChange={(e) => setReason(e.target.value)} className="ba-in">
              {rejectReasons.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value={OTHER}>Другая причина…</option>
            </select>
            <input name="reasonOther" maxLength={300} required={reason === OTHER} className="ba-in" placeholder={reason === OTHER ? "Причина" : "Пояснение"} />
            <button type="submit" className="ba-btn ba-btn--danger" disabled={disabled}>{spin("reject")}Отказать</button>
            <p className="ba-hint">Строка уйдёт из цены; если клиент уже заплатил — разница вернётся на баланс.</p>
          </form>
        )}

        {(s === "PURCHASED" || s === "SHIPPED" || s === "AT_WAREHOUSE") && (
          <form className="ba-form" onSubmit={handle("return", (d) => returnLine(purchaseId, line.id, d), `Возврат по строке ${line.lineNo}: вернуть ${refund || "0"} ¥ на баланс?`)}>
            <b>Возврат</b>
            <label className="ba-check">
              <input type="radio" name="returnKind" value="SELLER" checked={returnKind === "SELLER"} onChange={() => { setReturnKind("SELLER"); setRefund(suggest("SELLER", 0)); }} />
              Брак / не тот товар — за счёт продавца
            </label>
            <label className="ba-check">
              <input type="radio" name="returnKind" value="CLIENT" checked={returnKind === "CLIENT"} onChange={() => { setReturnKind("CLIENT"); setRefund(suggest("CLIENT", parseMoney(returnCost) ?? 0)); }} />
              Клиент передумал — за его счёт
            </label>
            {returnKind === "CLIENT" && (
              <label className="ba-field"><span>Доставка продавцу, ¥</span><input name="returnCostCny" value={returnCost} inputMode="decimal" onChange={(e) => { setReturnCost(e.target.value); setRefund(suggest("CLIENT", parseMoney(e.target.value) ?? 0)); }} /></label>
            )}
            <label className="ba-field"><span>На баланс, ¥ (строка стоит {yuan(line.costCny)})</span><input name="refundCny" value={refund} onChange={(e) => setRefund(e.target.value)} inputMode="decimal" required /></label>
            <input name="note" maxLength={300} className="ba-in" placeholder="Пояснение" />
            <button type="submit" className="ba-btn ba-btn--danger" disabled={disabled || !returnKind}>{spin("return")}Оформить возврат</button>
          </form>
        )}

        <form className="ba-form" onSubmit={handle("notes", (d) => updateLineNotes(purchaseId, line.id, d))}>
          <b>Учёт строки</b>
          <label className="ba-field"><span>Заказ у продавца</span><input name="sellerOrderNo" defaultValue={line.sellerOrderNo} maxLength={80} /></label>
          <label className="ba-field"><span>Заплачено продавцу, ¥</span><input name="paidToSellerCny" defaultValue={line.paidToSellerCny} inputMode="decimal" /></label>
          <input type="hidden" name="photoUrl" value={photoUrl} />
          <div className="ba-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- превью загруженного фото */}
            {photoUrl ? <img src={photoUrl} alt="" /> : null}
            <label className="ba-btn">
              {uploading ? <Loader2 size={13} className="ba-spin" /> : null}
              {photoUrl ? "Заменить фото" : "Фото товара"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden disabled={disabled || uploading} onChange={(e) => uploadPhoto(e.target.files?.[0])} />
            </label>
            {photoUrl && <button type="button" className="ba-btn" onClick={() => setPhotoUrl("")} disabled={disabled}>Убрать</button>}
          </div>
          <button type="submit" className="ba-btn" disabled={disabled || uploading}>{spin("notes")}Сохранить</button>
          {line.hasOrder && <p className="ba-hint">Фото переходит в заказ при его создании.</p>}
        </form>

        {message && <p className={message.ok ? "ba-ok" : "ba-error"} role="status">{message.text}</p>}
      </div>
      <style>{ACTIONS_CSS}</style>
    </details>
  );
}
