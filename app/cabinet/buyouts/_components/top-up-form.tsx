"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createTopUpRequest } from "@/actions/buyout-cabinet";
import FilePicker, { type PickedFile } from "./file-picker";

// Заявка на пополнение баланса: клиент оплатил по реквизитам и присылает сумму, способ, номер платежа и скриншот.
// Деньги появятся на балансе, когда сотрудник проверит оплату и нажмёт «Зачислить».

export default function TopUpForm({ customerId, methods, amount }: { customerId: string; methods: string[]; amount: string }) {
  const router = useRouter();
  const [screenshot, setScreenshot] = useState<PickedFile[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("screenshotUrl", screenshot[0]?.url ?? "");
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await createTopUpRequest(data);
        setMessage(result.ok ? { ok: true, text: result.message ?? "Заявка отправлена" } : { ok: false, text: result.error });
        if (result.ok) {
          form.reset();
          setScreenshot([]);
          router.refresh();
        }
      } catch {
        setMessage({ ok: false, text: "Не получилось — попробуйте ещё раз" });
      }
    });
  }

  return (
    <form className="bk-form" onSubmit={onSubmit}>
      <div className="bk-row">
        <label className="bk-field">
          Сумма, ¥
          <input name="amount" inputMode="decimal" defaultValue={amount} required placeholder="500" />
        </label>
        {methods.length > 0 && (
          <label className="bk-field">
            Способ
            <select name="method" required defaultValue="">
              <option value="" disabled>Выберите</option>
              {methods.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="bk-field">
        Номер платежа <small>из приложения банка, Alipay или WeChat</small>
        <input name="reference" maxLength={120} autoComplete="off" />
      </label>
      <div className="bk-field">
        Скриншот оплаты <small>номер платежа или скриншот — обязательно что-то одно</small>
        <FilePicker customerId={customerId} value={screenshot} onChange={setScreenshot} max={1} label="Скриншот" onError={(text) => setMessage(text ? { ok: false, text } : null)} />
      </div>
      <label className="bk-field">
        Комментарий <small>необязательно</small>
        <input name="note" maxLength={500} />
      </label>
      {message && <p className={message.ok ? "bk-ok" : "bk-error"} role="status">{message.text}</p>}
      <button type="submit" className="bk-btn bk-btn--primary" disabled={pending}>
        {pending ? <Loader2 size={16} className="bk-spin" /> : null}
        Отправить на проверку
      </button>
    </form>
  );
}
