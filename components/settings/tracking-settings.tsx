"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { checkTrackingConnection, removeTrackingKey, saveTrackingKey, syncTrackingNow } from "@/actions/tracking";

// «Настройки» → «Отслеживание посылок»: ключ 17TRACK, проверка связи, проверка посылок сейчас.
// Сам ключ в браузер не приходит — только последние 4 знака.

type Props = {
  keyTail: string | null;
  isAdmin: boolean;
  lastSyncAt: string | null;
  lastSync: string | null;
  tracked: number;
  problems: number;
};

export default function TrackingSettings({ keyTail, isAdmin, lastSyncAt, lastSync, tracked, problems }: Props) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(name: string, action: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(name);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        setMessage({ ok: result.ok, text: result.message });
        if (result.ok) router.refresh();
      } catch {
        setMessage({ ok: false, text: "Не получилось — попробуйте ещё раз" });
      } finally {
        setBusy(null);
      }
    });
  }

  const spinner = (name: string) => (busy === name ? <Loader2 size={14} className="trk-spin" /> : null);

  return (
    <div className="trk">
      <p className="trk-text">
        Посылки со статусом «Отправлена» и трек-номером система сама проверяет в 17TRACK раз в 2 часа. Доставленные
        переводит в «Доставлена» и сообщает клиенту. Возвраты, неудачные вручения и вопросы таможни отмечает
        «требует внимания» — их статус меняете вы.
      </p>

      <dl className="trk-list">
        <div><dt>Ключ 17TRACK</dt><dd>{keyTail ? <>сохранён (…{keyTail})</> : <span className="trk-warn">не задан — отслеживание выключено</span>}</dd></div>
        <div><dt>Посылок на слежении</dt><dd>{tracked}{problems ? <> · <span className="trk-warn">требуют внимания: {problems}</span></> : null}</dd></div>
        <div><dt>Последняя проверка</dt><dd>{lastSyncAt ? <>{lastSyncAt}{lastSync ? <span className="trk-muted"> — {lastSync}</span> : null}</> : "ещё не было"}</dd></div>
      </dl>

      {isAdmin && (
        <form
          className="trk-key"
          onSubmit={(e) => {
            e.preventDefault();
            run("save", async () => {
              const result = await saveTrackingKey(key);
              if (result.ok) setKey("");
              return result;
            });
          }}
        >
          <input
            type="password"
            className="trk-input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={keyTail ? "Новый ключ — заменит сохранённый" : "Ключ API из кабинета 17TRACK"}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="trk-btn trk-btn--primary" disabled={!key.trim() || busy !== null}>
            {spinner("save")} Сохранить ключ
          </button>
        </form>
      )}

      <div className="trk-actions">
        <button type="button" className="trk-btn" disabled={!keyTail || busy !== null} onClick={() => run("check", checkTrackingConnection)}>
          {spinner("check")} Проверить связь
        </button>
        <button type="button" className="trk-btn" disabled={!keyTail || busy !== null} onClick={() => run("sync", syncTrackingNow)}>
          {spinner("sync")} Проверить посылки сейчас
        </button>
        {isAdmin && keyTail && (
          <button
            type="button"
            className="trk-btn trk-btn--danger"
            disabled={busy !== null}
            onClick={() => {
              if (confirm("Удалить ключ? Отслеживание выключится.")) run("remove", removeTrackingKey);
            }}
          >
            {spinner("remove")} Удалить ключ
          </button>
        )}
      </div>

      {message && <p className={message.ok ? "trk-ok" : "trk-error"} role="status">{message.text}</p>}

      {!keyTail && (
        <details className="trk-help">
          <summary>Где взять ключ</summary>
          <ol>
            <li>Зарегистрируйтесь на <a href="https://api.17track.net" target="_blank" rel="noopener noreferrer">api.17track.net</a> (бесплатный тариф — 100 номеров в месяц).</li>
            <li>В кабинете API найдите ключ (обычно «Settings» → «Security Key» или «Access Key») и скопируйте его.</li>
            <li>Вставьте его в поле выше и нажмите «Сохранить ключ» — система сразу проверит, что ключ рабочий.</li>
          </ol>
        </details>
      )}

      <style>{`
        .trk { display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
        .trk-text { margin: 0; color: var(--color-text-secondary); line-height: 1.5; }
        .trk-list { margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .trk-list > div { display: flex; gap: 12px; }
        .trk-list dt { width: 140px; flex-shrink: 0; color: var(--color-muted); }
        .trk-list dd { margin: 0; flex: 1; min-width: 0; word-break: break-word; }
        .trk-muted { color: var(--color-muted); }
        .trk-warn { color: var(--color-warning); font-weight: 600; }
        .trk-key { display: flex; gap: 8px; }
        .trk-input { flex: 1; min-width: 0; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font: inherit; font-family: var(--font-mono); background: var(--color-surface); color: var(--color-text); outline: none; }
        .trk-input:focus { border-color: var(--color-accent); }
        .trk-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .trk-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; cursor: pointer; white-space: nowrap; }
        .trk-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
        .trk-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .trk-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-fg); }
        .trk-btn--primary:hover:not(:disabled) { background: var(--color-accent-hover); }
        .trk-btn--danger { color: var(--color-danger); }
        .trk-ok, .trk-error { margin: 0; padding: 8px 10px; border-radius: var(--radius-sm); line-height: 1.45; }
        .trk-ok { color: var(--color-success); background: var(--color-success-bg); }
        .trk-error { color: var(--color-danger); background: var(--color-warning-bg); }
        .trk-help summary { cursor: pointer; color: var(--color-accent); }
        .trk-help ol { margin: 8px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; color: var(--color-text-secondary); }
        .trk-help a { color: var(--color-accent); }
        .trk-spin { animation: trk-spin 0.8s linear infinite; }
        @keyframes trk-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
