"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
import { cancelPurchase, payPurchase, type CabinetResult } from "@/actions/purchase-cabinet";
import { round2, yuan } from "@/lib/purchase-money";

// Кнопки покупки в кабинете: «Оплатить с баланса» (или «Доплатить»), «Отменить» (до оплаты).
// Не хватает денег — сколько пополнить и ссылка на пополнение с этой суммой.

export default function PurchaseCardActions({ id, number, canCancel, due, balance }: { id: string; number: string; canCancel: boolean; due: number; balance: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [result, setResult] = useState<CabinetResult | null>(null);
  const short = due > 0 && balance < due ? round2(due - balance) : 0;
  const shortBy = result && !result.ok && result.shortBy ? result.shortBy : short;

  // После оплаты или отмены итог показывает страница (?done=…): у покупки уже другой шаг
  function run(name: "pay" | "cancel", action: () => Promise<CabinetResult>, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(name);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.ok) {
          router.replace(`/cabinet/purchases?done=${name === "pay" ? "paid" : "canceled"}&n=${encodeURIComponent(number)}`, { scroll: false });
          router.refresh();
        } else setResult(res);
      } catch {
        setResult({ ok: false, error: "Не получилось — попробуйте ещё раз" });
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <>
      <div className="bk-actions">
        {due > 0 &&
          (shortBy > 0 ? (
            <Link href={`/cabinet/purchases/balance?amount=${shortBy}`} className="bk-btn bk-btn--primary">
              <Wallet size={16} />
              Пополнить на {yuan(shortBy)}
            </Link>
          ) : (
            <button type="button" className="bk-btn bk-btn--primary" disabled={pending} onClick={() => run("pay", () => payPurchase(id, String(due)), `Оплатить ${yuan(due)} с баланса?`)}>
              {busy === "pay" ? <Loader2 size={16} className="bk-spin" /> : null}
              Оплатить с баланса {yuan(due)}
            </button>
          ))}
        {canCancel && (
          <button type="button" className="bk-btn bk-btn--ghost bk-btn--small" disabled={pending} onClick={() => run("cancel", () => cancelPurchase(id), "Отменить покупку?")}>
            {busy === "cancel" ? <Loader2 size={14} className="bk-spin" /> : null}
            Отменить
          </button>
        )}
      </div>
      {due > 0 && shortBy > 0 && !result && (
        <p className="bk-hint">На балансе {yuan(balance)} — не хватает {yuan(shortBy)}. Пополните баланс, и кнопка оплаты появится здесь.</p>
      )}
      {result && <p className={result.ok ? "bk-ok" : "bk-error"} role="status">{result.ok ? result.message ?? "Готово" : result.error}</p>}
    </>
  );
}
