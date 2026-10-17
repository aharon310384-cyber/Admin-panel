"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

/** Страница отслеживания на сайте PostmanFox. */
export const TRACKING_PAGE_URL = "https://postmanfox.com/ru/treking-posylok/";

/** Копирует текст в буфер обмена; запасной способ — для старых браузеров и WebView. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Блок «Трек-номер посылки»: подпись, номер, иконка копирования и кнопка «Отследить».
 * «Отследить» копирует номер и открывает страницу отслеживания на сайте, где его остаётся вставить.
 * Если номера нет — короткая подсказка без кнопок.
 */
export default function TrackNumber({ trackingNumber }: { trackingNumber: string | null }) {
  const number = trackingNumber?.trim() || null;
  const [notice, setNotice] = useState<"copied" | "track" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = (kind: "copied" | "track", ms: number) => {
    setNotice(kind);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), ms);
  };

  const onCopy = async () => {
    if (number && (await copyText(number))) show("copied", 1800);
  };

  const onTrack = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!number) return;
    // Копирование запускается в момент клика, переход по ссылке его не ждёт
    void copyText(number).then((ok) => ok && show("track", 6000));
    // Внутри Telegram внешние ссылки открываются через SDK
    const wa = window.Telegram?.WebApp;
    if (wa?.initData && wa.openLink) {
      e.preventDefault();
      wa.openLink(TRACKING_PAGE_URL);
    }
  };

  return (
    <div className="cab-track">
      <div className="cab-track-info">
        <span className="cab-track-label">Трек-номер посылки</span>
        {number ? (
          <span className="cab-track-numrow">
            <span className="cab-track-num">{number}</span>
            <button
              type="button"
              className="cab-track-copy"
              onClick={onCopy}
              aria-label={notice === "copied" ? "Скопировано" : "Скопировать трек-номер"}
              title={notice === "copied" ? "Скопировано" : "Скопировать"}
            >
              {notice === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            </button>
          </span>
        ) : (
          <span className="cab-track-none">Пока не присвоен</span>
        )}
      </div>
      {number && (
        <a
          className="cab-track-btn"
          href={TRACKING_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onTrack}
        >
          Отследить
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      )}
      {notice === "track" && (
        <span className="cab-track-hint" role="status">
          Номер скопирован — вставьте его в поле на сайте
        </span>
      )}

      <style>{`
        .cab-track { display: flex; align-items: center; gap: 8px 16px; flex-wrap: wrap; min-width: 0; }
        .cab-track-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .cab-track-label { font-size: 12px; font-weight: 600; color: var(--cab-muted); }
        .cab-track-numrow { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
        .cab-track-num {
          font-family: var(--font-jetbrains-mono), monospace; font-size: 15px; font-weight: 600;
          color: var(--cab-text); word-break: break-all;
        }
        .cab-track-copy {
          position: relative; z-index: 1;
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 26px; height: 26px; padding: 0; border-radius: 8px; cursor: pointer;
          color: var(--cab-muted); background: transparent; border: 1px solid transparent;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .cab-track-copy:hover { color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-green) 10%, transparent); }
        .cab-track-copy:focus-visible { outline: 2px solid var(--cab-green); outline-offset: 1px; }
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
        .cab-track-hint { flex-basis: 100%; font-size: 12px; font-weight: 600; color: var(--cab-green-deep); }
      `}</style>
    </div>
  );
}
