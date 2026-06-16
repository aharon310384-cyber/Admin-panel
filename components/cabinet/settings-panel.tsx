"use client";

import { useState } from "react";
import { Bell, Globe, MessageCircle, Moon, ShieldCheck } from "lucide-react";

type Toggle = {
  key: string;
  icon: typeof Bell;
  title: string;
  desc: string;
  defaultOn: boolean;
};

const TOGGLES: Toggle[] = [
  { key: "push", icon: Bell, title: "Уведомления о статусах", desc: "Сообщать об изменении статуса посылки", defaultOn: true },
  { key: "pay", icon: ShieldCheck, title: "Напоминания об оплате", desc: "Предупреждать о посылках к оплате", defaultOn: true },
  { key: "dark", icon: Moon, title: "Тёмная тема", desc: "Скоро будет доступна", defaultOn: false },
];

const LANGS = [
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

export default function SettingsPanel() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    () => Object.fromEntries(TOGGLES.map((t) => [t.key, t.defaultOn]))
  );
  const [lang, setLang] = useState("ru");
  const [tgLinked, setTgLinked] = useState(false);

  const flip = (key: string) => setToggles((p) => ({ ...p, [key]: !p[key] }));

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
              <button
                type="button"
                role="switch"
                aria-checked={toggles[t.key]}
                aria-label={t.title}
                className={`sp-switch ${toggles[t.key] ? "sp-switch--on" : ""}`}
                onClick={() => flip(t.key)}
              >
                <span className="sp-knob" />
              </button>
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
            <button
              key={l.code}
              type="button"
              className={`sp-lang ${lang === l.code ? "sp-lang--on" : ""}`}
              onClick={() => setLang(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-card">
        <div className="sp-tg">
          <span className="sp-tg-icon"><MessageCircle size={18} /></span>
          <div className="sp-tg-body">
            <h3 className="sp-card-title">Telegram</h3>
            <span className="sp-toggle-desc">
              {tgLinked ? "Аккаунт привязан — уведомления в чат" : "Привяжите чат, чтобы получать уведомления"}
            </span>
          </div>
          <button
            type="button"
            className={`sp-tg-btn ${tgLinked ? "sp-tg-btn--linked" : ""}`}
            onClick={() => setTgLinked((v) => !v)}
          >
            {tgLinked ? "Отвязать" : "Привязать"}
          </button>
        </div>
      </div>

      <p className="sp-note">Изменения пока не сохраняются — раздел в разработке.</p>

      <style>{`
        .sp { display: flex; flex-direction: column; gap: 12px; }
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
          flex-shrink: 0; width: 44px; height: 26px; border-radius: 999px; border: none; cursor: pointer;
          background: var(--cab-border-strong); position: relative; transition: background 0.2s;
        }
        .sp-switch--on { background: var(--cab-green); }
        .sp-knob {
          position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
          background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: transform 0.2s;
        }
        .sp-switch--on .sp-knob { transform: translateX(18px); }

        .sp-langs { display: flex; gap: 8px; flex-wrap: wrap; }
        .sp-lang {
          padding: 9px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer;
          color: var(--cab-text-soft); background: color-mix(in srgb, var(--cab-bg) 55%, var(--cab-surface));
          border: 1px solid var(--cab-border); transition: all 0.15s;
        }
        .sp-lang:hover { border-color: var(--cab-border-strong); }
        .sp-lang--on {
          color: #fff; border-color: transparent;
          background: linear-gradient(150deg, var(--cab-green), var(--cab-green-deep));
        }

        .sp-tg { display: flex; align-items: center; gap: 12px; }
        .sp-tg-icon {
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 40px; height: 40px; border-radius: 12px; color: #fff;
          background: linear-gradient(150deg, #37aee2, #1e96c8);
        }
        .sp-tg-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .sp-tg-btn {
          flex-shrink: 0; padding: 9px 16px; border-radius: 11px; font-size: 13px; font-weight: 600; cursor: pointer;
          color: #fff; border: none;
          background: linear-gradient(150deg, var(--cab-green), var(--cab-green-deep));
          transition: opacity 0.15s;
        }
        .sp-tg-btn:hover { opacity: 0.92; }
        .sp-tg-btn--linked {
          color: var(--cab-danger); background: var(--cab-surface);
          border: 1px solid color-mix(in srgb, var(--cab-danger) 30%, var(--cab-border));
        }

        .sp-note { margin: 0; font-size: 12px; color: var(--cab-muted); text-align: center; }
      `}</style>
    </div>
  );
}
