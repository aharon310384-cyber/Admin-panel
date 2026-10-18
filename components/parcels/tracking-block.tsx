"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { refreshParcelTracking } from "@/actions/tracking";

// Карточка посылки → «Отслеживание»: трек-номер, что знает 17TRACK, события, кнопка «Обновить».

export type TrackingView = {
  statusLabel: string;
  problem: boolean;
  delivered: boolean;
  registered: boolean;
  carrierName: string | null;
  event: string | null;
  location: string | null;
  eventAt: string | null;
  checkedAt: string | null;
  error: string | null;
  events: { at: string | null; text: string; location: string | null }[];
};

type Props = {
  parcelId: string;
  trackingNumber: string | null;
  trackUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  enabled: boolean;
  tracking: TrackingView | null;
};

export default function TrackingBlock({ parcelId, trackingNumber, trackUrl, shippedAt, deliveredAt, enabled, tracking }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await refreshParcelTracking(parcelId);
      setMessage({ ok: result.ok, text: result.message });
      router.refresh();
    });

  const tone = !tracking?.registered ? "none" : tracking.problem ? "problem" : tracking.delivered ? "done" : "on";

  return (
    <div className="tb">
      <dl className="tb-list">
        <div><dt>Трек-номер посылки</dt><dd>
          {trackingNumber && trackUrl ? (
            <a className="tb-link" href={trackUrl} target="_blank" rel="noopener noreferrer">
              <span className="tb-mono">{trackingNumber}</span> <ExternalLink size={13} />
            </a>
          ) : <span className="tb-muted">не присвоен</span>}
        </dd></div>

        {trackingNumber && (
          <div><dt>Отслеживание</dt><dd>
            {tracking?.registered ? (
              <>
                <span className={`tb-badge tb-badge--${tone}`}>{tracking.statusLabel}</span>
                {tracking.carrierName && <span className="tb-muted"> · {tracking.carrierName}</span>}
              </>
            ) : tracking?.error ? (
              <span className="tb-badge tb-badge--problem">Не на слежении</span>
            ) : (
              <span className="tb-muted">{enabled ? "ещё не проверялась" : "выключено: нет ключа 17TRACK («Настройки»)"}</span>
            )}
          </dd></div>
        )}

        {tracking?.event && (
          <div><dt>Последнее событие</dt><dd>
            {tracking.event}
            {(tracking.location || tracking.eventAt) && (
              <span className="tb-muted"> · {[tracking.location, tracking.eventAt].filter(Boolean).join(", ")}</span>
            )}
          </dd></div>
        )}
        {tracking?.error && <div><dt>Ошибка 17TRACK</dt><dd className="tb-error">{tracking.error}</dd></div>}
        {tracking?.checkedAt && <div><dt>Проверено</dt><dd>{tracking.checkedAt}</dd></div>}
        <div><dt>Отправлена</dt><dd>{shippedAt ?? "—"}</dd></div>
        <div><dt>Доставлена</dt><dd>{deliveredAt ?? "—"}</dd></div>
      </dl>

      {trackingNumber && enabled && (
        <div className="tb-actions">
          <button type="button" className="tb-btn" onClick={refresh} disabled={pending}>
            {pending ? <Loader2 size={14} className="tb-spin" /> : <RefreshCw size={14} />}
            {tracking?.registered ? "Обновить отслеживание" : "Поставить на слежение"}
          </button>
          {message && <span className={message.ok ? "tb-ok" : "tb-error"} role="status">{message.text}</span>}
        </div>
      )}

      {tracking && tracking.events.length > 0 && (
        <details className="tb-events">
          <summary>Все события ({tracking.events.length})</summary>
          <ol>
            {tracking.events.map((event, i) => (
              <li key={i}>
                <span className="tb-muted tb-when">{event.at ?? "—"}</span>
                <span>{event.text}{event.location && <span className="tb-muted"> · {event.location}</span>}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <style>{`
        .tb { display: flex; flex-direction: column; gap: 10px; }
        .tb-list { display: flex; flex-direction: column; gap: 10px; margin: 0; }
        .tb-list > div { display: flex; gap: 12px; font-size: 13px; }
        .tb-list dt { width: 120px; flex-shrink: 0; color: var(--color-muted); }
        .tb-list dd { flex: 1; margin: 0; min-width: 0; word-break: break-word; color: var(--color-text); }
        .tb-mono { font-family: var(--font-mono); }
        .tb-muted { color: var(--color-muted); }
        .tb-link { display: inline-flex; align-items: center; gap: 5px; color: var(--color-accent); text-decoration: none; }
        .tb-link:hover { text-decoration: underline; }
        .tb-badge { display: inline-flex; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; }
        .tb-badge--on { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
        .tb-badge--done { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .tb-badge--problem { color: var(--color-danger); background: var(--color-warning-bg); }
        .tb-badge--none { color: var(--color-muted); background: var(--color-muted-bg); }
        .tb-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
        .tb-btn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 12.5px; cursor: pointer; }
        .tb-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
        .tb-btn:disabled { opacity: 0.6; cursor: wait; }
        .tb-ok { font-size: 12px; color: var(--color-success); }
        .tb-error { font-size: 12px; color: var(--color-danger); }
        .tb-events summary { cursor: pointer; font-size: 12.5px; color: var(--color-accent); }
        .tb-events ol { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; }
        .tb-events li { display: flex; gap: 10px; }
        .tb-when { flex-shrink: 0; width: 112px; font-variant-numeric: tabular-nums; }
        .tb-spin { animation: tb-spin 0.8s linear infinite; }
        @keyframes tb-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
