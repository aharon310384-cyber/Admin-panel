"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { TopUpRequestStatus } from "@prisma/client";
import { cancelTopUp, creditTopUp, stornoTopUp, type TopUpResult } from "@/actions/top-ups";
import { yuan } from "@/lib/purchase-money";

// Карточка заявки на пополнение: «Зачислить», «Отклонить», у зачисленной — «Сторно».

type Props = {
  id: string;
  status: TopUpRequestStatus;
  isAdmin: boolean;
  amount: string;
  method: string;
  reference: string;
  methods: string[];
  confirmAbove: number | null;
};

export default function TopUpActions(props: Props) {
  const { id, status, isAdmin } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [amount, setAmount] = useState(props.amount);
  const needsPassword = props.confirmAbove == null || Number(amount.replace(",", ".")) > props.confirmAbove;

  const handle = (name: string, action: (id: string, data: FormData) => Promise<TopUpResult>, confirmText: (data: FormData) => string) =>
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      if (!window.confirm(confirmText(data))) return;
      setBusy(name);
      setMessage(null);
      startTransition(async () => {
        try {
          const result = await action(id, data);
          setMessage(result.ok ? { ok: true, text: result.message ?? "Готово" } : { ok: false, text: result.error });
          if (result.ok) {
            form.reset();
            router.refresh();
          }
        } catch {
          setMessage({ ok: false, text: "Не получилось — проверьте права и попробуйте ещё раз" });
        } finally {
          setBusy(null);
        }
      });
    };
  const spin = (name: string) => (busy === name ? <Loader2 size={14} className="ta-spin" /> : null);
  const disabled = pending || !isAdmin;
  const methods = props.method && !props.methods.includes(props.method) ? [props.method, ...props.methods] : props.methods;

  return (
    <div className="ta">
      {!isAdmin && <p className="ta-note">Зачисляет и отклоняет администратор.</p>}

      {status === "PENDING" && (
        <>
          <form className="card card--pad ta-form" onSubmit={handle("credit", creditTopUp, (d) => `Зачислить ${yuan(Number(String(d.get("amount")).replace(",", ".")))} на баланс клиента?`)}>
            <h2 className="card-title">Зачислить</h2>
            <p className="ta-hint">Сверьте оплату в Alipay / WeChat / банке: сумму, номер платежа, скриншот.</p>
            <label className="ta-field"><span>Сколько пришло, ¥</span><input name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required /></label>
            <label className="ta-field">
              <span>Способ</span>
              <select name="method" defaultValue={props.method}>
                <option value="">—</option>
                {methods.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="ta-field"><span>Номер платежа</span><input name="reference" defaultValue={props.reference} required className="ta-mono" /></label>
            {needsPassword && (
              <label className="ta-field">
                <span>Ваш пароль — подтверждение{props.confirmAbove != null ? ` (сумма больше ${yuan(props.confirmAbove)})` : ""}</span>
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
            )}
            <button type="submit" className="ta-btn ta-btn--primary" disabled={disabled}>{spin("credit")}Зачислить</button>
            <p className="ta-hint">Один номер платежа зачисляется один раз. Клиенту придёт сообщение.</p>
          </form>

          <form className="card card--pad ta-form" onSubmit={handle("cancel", cancelTopUp, () => "Отклонить заявку?")}>
            <h2 className="card-title">Отклонить</h2>
            <label className="ta-field"><span>Причина — её увидит клиент</span><input name="reason" required maxLength={300} placeholder="оплата не найдена" /></label>
            <button type="submit" className="ta-btn ta-btn--danger" disabled={disabled}>{spin("cancel")}Отклонить</button>
          </form>
        </>
      )}

      {status === "PAID" && (
        <form className="card card--pad ta-form" onSubmit={handle("storno", stornoTopUp, () => "Сторнировать зачисление? Баланс клиента уменьшится на эту сумму.")}>
          <h2 className="card-title">Сторно</h2>
          <p className="ta-hint">Зачислили по ошибке? Зачисление не удаляется: в регистре появится обратная запись, приход ДС — с пометкой удаления.</p>
          <label className="ta-field"><span>Причина</span><input name="reason" required maxLength={300} /></label>
          <label className="ta-field"><span>Ваш пароль</span><input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit" className="ta-btn ta-btn--danger" disabled={disabled}>{spin("storno")}Сторнировать</button>
        </form>
      )}

      {message && <p className={message.ok ? "ta-ok" : "ta-error"} role="status">{message.text}</p>}

      <style>{`
        .ta { display: flex; flex-direction: column; gap: 12px; }
        .ta-form { display: flex; flex-direction: column; gap: 8px; }
        .ta-form .card-title { margin: 0 0 2px; }
        .ta-field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; }
        .ta-field > span { color: var(--color-muted); }
        .ta-field input, .ta-field select { padding: 7px 9px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font: inherit; font-size: 13.5px; background: var(--color-surface); color: var(--color-text); outline: none; }
        .ta-field input:focus, .ta-field select:focus { border-color: var(--color-accent); }
        .ta-mono { font-family: var(--font-mono); }
        .ta-hint { margin: 0; font-size: 12px; color: var(--color-muted); line-height: 1.45; }
        .ta-note { margin: 0; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--color-muted-bg); color: var(--color-text-secondary); font-size: 13px; }
        .ta-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 13px; cursor: pointer; }
        .ta-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .ta-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-fg); }
        .ta-btn--danger { color: var(--color-danger); }
        .ta-ok, .ta-error { margin: 0; padding: 8px 10px; border-radius: var(--radius-sm); line-height: 1.45; font-size: 13px; }
        .ta-ok { color: var(--color-success); background: var(--color-success-bg); }
        .ta-error { color: var(--color-danger); background: var(--color-warning-bg); }
        .ta-spin { animation: ta-spin 0.8s linear infinite; }
        @keyframes ta-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
