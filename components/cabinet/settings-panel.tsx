"use client";

import { Bell, Globe, Moon, ShieldCheck } from "lucide-react";

type Toggle = {
  key: string;
  icon: typeof Bell;
  title: string;
  desc: string;
  on: boolean;
};

// Раздел в разработке — контролы пассивны (disabled), показывают планируемое состояние.
const TOGGLES: Toggle[] = [
  { key: "push", icon: Bell, title: "Уведомления о статусах", desc: "Сообщать об изменении статуса посылки", on: true },
  { key: "pay", icon: ShieldCheck, title: "Напоминания об оплате", desc: "Предупреждать о посылках к оплате", on: true },
  { key: "dark", icon: Moon, title: "Тёмная тема", desc: "Скоро будет доступна", on: false },
];

const LANGS = [
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

export default function SettingsPanel() {
  const activeLang = "ru";

  return (
    <div className="sp">
      <div className="sp-card">
        <h3 className="sp-card-title">Уведомления</h3>
        <ul className="sp-toggles">
          {TOGGLES.map((t) => (
            <li key={t.key} className="sp-toggle">
              <span className="sp-toggle-icon"><t.icon size={16} /></span>
              <span className="sp-toggle-body">
                <span className="sp-toggle-title">{t.title}</span>
                <span className="sp-toggle-desc">{t.desc}</span>
              </span>
              <span
                role="switch"
                aria-checked={t.on}
                aria-disabled="true"
                aria-label={t.title}
                className={`sp-switch ${t.on ? "sp-switch--on" : ""}`}
              >
                <span className="sp-knob" />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="sp-card">
        <div className="sp-card-row">
          <span className="sp-toggle-icon"><Globe size={16} /></span>
          <h3 className="sp-card-title">Язык</h3>
        </div>
        <div className="sp-langs">
          {LANGS.map((l) => (
            <span
              key={l.code}
              aria-disabled="true"
              className={`sp-lang ${activeLang === l.code ? "sp-lang--on" : ""}`}
            >
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <p className="sp-note">Раздел в разработке — настройки пока недоступны.</p>

      <style>{`
        .sp { display: flex; flex-direction: column; gap: 12px; opacity: 0.85; }
        .sp-card {
          display: flex; flex-direction: column; gap: 14px; padding: 16px;
          border-radius: var(--cab-radius-md); background: var(--cab-surface);
          border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm);
        }
        .sp-card-title { margin: 0; font-size: 14px; font-weight: 700; }
        .sp-card-row { display: flex; align-items: center; gap: 10px; }

        .sp-toggles { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
        .sp-toggle { display: flex; align-items: center; gap: 12px; }
        .sp-toggle-icon {
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 34px; height: 34px; border-radius: 11px; color: var(--cab-green-deep);
          background: color-mix(in srgb, var(--cab-green) 12%, transparent);
        }
        .sp-toggle-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .sp-toggle-title { font-size: 13.5px; font-weight: 600; }
        .sp-toggle-desc { font-size: 11.5px; color: var(--cab-muted); line-height: 1.35; }

        .sp-switch {
          flex-shrink: 0; width: 44px; height: 26px; border-radius: 999px; border: none; cursor: not-allowed;
          background: var(--cab-border-strong); position: relative; display: inline-block;
        }
        .sp-switch--on { background: color-mix(in srgb, var(--cab-green) 55%, var(--cab-border-strong)); }
        .sp-knob {
          position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
          background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .sp-switch--on .sp-knob { transform: translateX(18px); }

        .sp-langs { display: flex; gap: 8px; flex-wrap: wrap; }
        .sp-lang {
          padding: 9px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: not-allowed;
          color: var(--cab-text-soft); background: color-mix(in srgb, var(--cab-bg) 55%, var(--cab-surface));
          border: 1px solid var(--cab-border);
        }
        .sp-lang--on {
          color: #fff; border-color: transparent;
          background: linear-gradient(150deg, var(--cab-green), var(--cab-green-deep));
        }

        .sp-note { margin: 0; font-size: 12px; color: var(--cab-muted); text-align: center; }
      `}</style>
    </div>
  );
}
