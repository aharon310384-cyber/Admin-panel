"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { saveBuyoutSettings } from "@/actions/buyout-settings";

// «Выкуп → Настройки выкупа»: комиссия, префикс номера, причины отказа, условия сервиса; пополнение баланса.

export type BuyoutSettingsInitial = {
  commissionPercent: string;
  commissionMinCny: string;
  numberPrefix: string;
  rejectReasons: string;
  rulesText: string;
  topUpMethods: string;
  topUpInstructions: string;
  topUpConfirmAboveCny: string;
};

export default function BuyoutSettingsForm({ initial, isAdmin, companyName }: { initial: BuyoutSettingsInitial; isAdmin: boolean; companyName: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await saveBuyoutSettings(data);
        setMessage(result.ok ? { ok: true, text: "Сохранено" } : { ok: false, text: result.error });
        if (result.ok) router.refresh();
      } catch {
        setMessage({ ok: false, text: "Не получилось — проверьте права и попробуйте ещё раз" });
      }
    });
  }

  return (
    <form className="bs" onSubmit={onSubmit}>
      <p className="bs-text">
        Настройки компании клиентов{companyName ? ` «${companyName}»` : ""}. Чисел в программе нет: всё, что видит клиент и что считает программа, — отсюда.
      </p>
      <div className="bs-grid">
        <section className="card card--pad bs-sec">
          <h2 className="card-title">Комиссия и номер</h2>
          <label className="bs-field"><span>Комиссия, % от суммы товара</span><input name="commissionPercent" defaultValue={initial.commissionPercent} inputMode="decimal" placeholder="не задана — цену не посчитать" /></label>
          <label className="bs-field"><span>Минимальная комиссия, ¥</span><input name="commissionMinCny" defaultValue={initial.commissionMinCny} inputMode="decimal" placeholder="без минимума" /></label>
          <label className="bs-field"><span>Префикс номера выкупа</span><input name="numberPrefix" defaultValue={initial.numberPrefix} maxLength={5} placeholder="VK" className="bs-mono" /></label>
          <p className="bs-hint">Номер — префикс и порядковый номер: VK-000001. Префикс — латинские буквы; новый префикс начинает счёт с 1.</p>
          <label className="bs-field"><span>Причины отказа — по одной в строке</span><textarea name="rejectReasons" defaultValue={initial.rejectReasons} rows={6} /></label>
          <label className="bs-field"><span>Условия сервиса — клиент видит в форме заявки</span><textarea name="rulesText" defaultValue={initial.rulesText} rows={6} /></label>
        </section>

        <section className="card card--pad bs-sec">
          <h2 className="card-title">Пополнение баланса</h2>
          <label className="bs-field"><span>Способы оплаты — по одному в строке</span><textarea name="topUpMethods" defaultValue={initial.topUpMethods} rows={5} /></label>
          <label className="bs-field"><span>Куда платить — реквизиты, клиент видит на странице баланса</span><textarea name="topUpInstructions" defaultValue={initial.topUpInstructions} rows={6} /></label>
          <label className="bs-field"><span>Зачисление больше этой суммы — с паролем, ¥</span><input name="topUpConfirmAboveCny" defaultValue={initial.topUpConfirmAboveCny} inputMode="decimal" placeholder="пусто — пароль при каждом зачислении" /></label>
          <p className="bs-hint">Зачисляет только администратор. Один номер платежа зачисляется один раз; ошибку исправляет «Сторно».</p>
        </section>
      </div>
      <div className="bs-bar">
        <button type="submit" className="bs-btn" disabled={pending || !isAdmin}>{pending ? <Loader2 size={14} className="bs-spin" /> : null}Сохранить</button>
        {!isAdmin && <span className="muted">Менять настройки может администратор.</span>}
        {message && <span className={message.ok ? "bs-ok" : "bs-error"} role="status">{message.text}</span>}
      </div>
      <style>{`
        .bs { display: flex; flex-direction: column; gap: 12px; }
        .bs-text { margin: 0; color: var(--color-text-secondary); font-size: 13px; }
        .bs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 12px; align-items: start; }
        .bs-sec { display: flex; flex-direction: column; gap: 10px; }
        .bs-field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; }
        .bs-field > span { color: var(--color-muted); }
        .bs-field input, .bs-field textarea { padding: 7px 9px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font: inherit; font-size: 13.5px; background: var(--color-surface); color: var(--color-text); outline: none; }
        .bs-field input:focus, .bs-field textarea:focus { border-color: var(--color-accent); }
        .bs-mono { font-family: var(--font-mono); text-transform: uppercase; }
        .bs-hint { margin: 0; font-size: 12px; color: var(--color-muted); }
        .bs-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .bs-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid var(--color-accent); border-radius: var(--radius-sm); background: var(--color-accent); color: var(--color-accent-fg); font: inherit; cursor: pointer; }
        .bs-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .bs-ok { color: var(--color-success); }
        .bs-error { color: var(--color-danger); }
        .bs-spin { animation: bs-spin 0.8s linear infinite; }
        @keyframes bs-spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
