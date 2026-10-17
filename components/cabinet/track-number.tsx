import { ExternalLink } from "lucide-react";

/** Ссылка на отслеживание трек-номера в 17track. */
export function trackingUrl(trackingNumber: string): string {
  return `https://t.17track.net/en#nums=${encodeURIComponent(trackingNumber)}`;
}

/**
 * Блок «Трек-номер посылки»: подпись, номер и кнопка «Отследить».
 * Если номера нет — короткая подсказка без кнопки.
 */
export default function TrackNumber({ trackingNumber }: { trackingNumber: string | null }) {
  const number = trackingNumber?.trim() || null;

  return (
    <div className="cab-track">
      <span className="cab-track-label">Трек-номер посылки</span>
      {number ? (
        <div className="cab-track-row">
          <span className="cab-track-num">{number}</span>
          <a
            className="cab-track-btn"
            href={trackingUrl(number)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Отследить
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      ) : (
        <span className="cab-track-none">Пока не присвоен</span>
      )}

      <style>{`
        .cab-track { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .cab-track-label { font-size: 12px; font-weight: 600; color: var(--cab-muted); }
        .cab-track-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; }
        .cab-track-num {
          font-family: var(--font-jetbrains-mono), monospace; font-size: 15px; font-weight: 600;
          color: var(--cab-text); word-break: break-all;
        }
        .cab-track-btn {
          position: relative; z-index: 1;
          display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
          padding: 6px 12px; border-radius: 999px; text-decoration: none;
          font-size: 12.5px; font-weight: 700; color: var(--cab-green-deep);
          background: color-mix(in srgb, var(--cab-green) 12%, var(--cab-surface));
          border: 1px solid color-mix(in srgb, var(--cab-green) 32%, transparent);
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .cab-track-btn:hover {
          background: color-mix(in srgb, var(--cab-green) 20%, var(--cab-surface));
          border-color: color-mix(in srgb, var(--cab-green) 50%, transparent);
        }
        .cab-track-btn:focus-visible { outline: 2px solid var(--cab-green); outline-offset: 2px; }
        .cab-track-none { font-size: 13px; color: var(--cab-muted); }
      `}</style>
    </div>
  );
}
