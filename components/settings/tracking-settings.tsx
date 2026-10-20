"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  checkTrackingConnection,
  removeTrackingKey,
  saveTrackingKey,
  saveTrackingOptions,
  searchTrackingCarriers,
  syncTrackingNow,
} from "@/actions/tracking";
import { TRACKING_LANGS } from "@/lib/tracking-labels";

// «Настройки» → «Отслеживание посылок»: ключ 17TRACK, проверка связи, проверка посылок сейчас.
// Сам ключ в браузер не приходит — только последние 4 знака. Ниже — язык событий и запасной перевозчик.

export type TrackingOptionsView = {
  lang: string;
  fallbackPrefixes: string;
  fallbackCarrier: number | null;
  fallbackCarrierName: string | null;
  fallbackAfterHours: number;
};

type Props = {
  options: TrackingOptionsView;
  keyTail: string | null;
  isAdmin: boolean;
  lastSyncAt: string | null;
  lastSync: string | null;
  tracked: number;
  problems: number;
};

export default function TrackingSettings({ options, keyTail, isAdmin, lastSyncAt, lastSync, tracked, problems }: Props) {
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
            <li>Зарегистрируйтесь на <a href="https://api.17track.net" target="_blank" rel="noopener noreferrer">api.17track.net</a> (новым аккаунтам — 200 номеров бесплатно один раз, дальше — пакеты).</li>
            <li>В кабинете API найдите ключ (обычно «Settings» → «Security Key» или «Access Key») и скопируйте его.</li>
            <li>Вставьте его в поле выше и нажмите «Сохранить ключ» — система сразу проверит, что ключ рабочий.</li>
          </ol>
        </details>
      )}

      {isAdmin && <TrackingOptions options={options} />}

      <style>{`
        .trk { display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
        .trk-opts { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--color-border); }
        .trk-h { margin: 0; font-size: 13px; font-weight: 600; }
        .trk-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .trk-row > span:first-child { width: 160px; flex-shrink: 0; color: var(--color-muted); }
        .trk-select, .trk-field { padding: 6px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font: inherit; background: var(--color-surface); color: var(--color-text); }
        .trk-field { flex: 1; min-width: 140px; }
        .trk-hours { flex: none; width: 70px; min-width: 0; }
        .trk-found { margin: 0; padding: 0; list-style: none; border: 1px solid var(--color-border); border-radius: var(--radius-sm); max-height: 200px; overflow: auto; }
        .trk-found button { width: 100%; text-align: left; padding: 6px 10px; border: none; border-bottom: 1px solid var(--color-border); background: none; font: inherit; cursor: pointer; }
        .trk-found button:hover { background: var(--color-muted-bg); }
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

/** Язык событий у 17TRACK и запасной перевозчик: номера с приставками, которые 17TRACK сам не нашёл, — к нему. */
function TrackingOptions({ options }: { options: TrackingOptionsView }) {
  const router = useRouter();
  const [lang, setLang] = useState(options.lang);
  const [prefixes, setPrefixes] = useState(options.fallbackPrefixes);
  const [carrier, setCarrier] = useState<{ key: number; name: string } | null>(
    options.fallbackCarrier ? { key: options.fallbackCarrier, name: options.fallbackCarrierName ?? `код ${options.fallbackCarrier}` } : null,
  );
  const [hours, setHours] = useState(String(options.fallbackAfterHours));
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ key: number; name: string; country: string | null }[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const search = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await searchTrackingCarriers(query);
      setFound(result.carriers);
      if (!result.ok) setMessage({ ok: false, text: result.message ?? "Не удалось найти перевозчика" });
      else if (!result.carriers.length) setMessage({ ok: false, text: "Не нашлось — попробуйте другое название" });
    });

  const save = () =>
    startTransition(async () => {
      const result = await saveTrackingOptions({
        lang,
        fallbackPrefixes: prefixes,
        fallbackCarrier: carrier?.key ?? null,
        fallbackCarrierName: carrier?.name ?? null,
        fallbackAfterHours: Number(hours),
      });
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });

  return (
    <div className="trk-opts">
      <h3 className="trk-h">Язык событий и запасной перевозчик</h3>
      <label className="trk-row">
        <span>Язык событий</span>
        <select className="trk-select" value={lang} onChange={(e) => setLang(e.target.value)}>
          {TRACKING_LANGS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </label>
      <p className="trk-text">Если перевозчик сам даёт события на этом языке — придут на нём (бесплатно), иначе — на языке перевозчика. Действует для новых номеров.</p>
      <label className="trk-row">
        <span>Номера на</span>
        <input className="trk-field" value={prefixes} onChange={(e) => setPrefixes(e.target.value.toUpperCase())} placeholder="CK, LK, LC" spellCheck={false} />
      </label>
      <div className="trk-row">
        <span>Запасной перевозчик</span>
        {carrier ? (
          <>
            <b>{carrier.name}</b> <span className="trk-muted">код {carrier.key}</span>
            <button type="button" className="trk-btn" onClick={() => setCarrier(null)}>Сменить</button>
          </>
        ) : (
          <>
            <input
              className="trk-field"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
              placeholder="Название в 17TRACK, например Meest"
            />
            <button type="button" className="trk-btn" onClick={search} disabled={pending || query.trim().length < 2}>Найти</button>
          </>
        )}
      </div>
      {!carrier && found.length > 0 && (
        <ul className="trk-found">
          {found.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={() => { setCarrier({ key: c.key, name: c.name }); setFound([]); setQuery(""); }}>
                {c.name} <span className="trk-muted">{c.country ? `· ${c.country} ` : ""}· код {c.key}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="trk-row">
        <span>Переставлять через</span>
        <input className="trk-field trk-hours" type="number" min={1} max={336} value={hours} onChange={(e) => setHours(e.target.value)} /> ч без данных
      </label>
      <p className="trk-text">
        Номер с такой приставкой сначала ищется как обычно. Если 17TRACK не определил перевозчика — номер сразу ставится на запасного;
        если за указанное время ничего не нашёл — переставляется на запасного (один раз, 17TRACK спишет ещё 1 номер).
      </p>
      <div className="trk-actions">
        <button type="button" className="trk-btn trk-btn--primary" onClick={save} disabled={pending}>Сохранить</button>
      </div>
      {message && <p className={message.ok ? "trk-ok" : "trk-error"} role="status">{message.text}</p>}
    </div>
  );
}
