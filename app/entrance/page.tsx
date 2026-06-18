"use client";

import Script from "next/script";
import Image from "next/image";
import { Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type State = "loading" | "need-link" | "browser-login" | "error";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME;

export default function TelegramEntryPage() {
  const [state, setState] = useState<State>("loading");
  const [notice, setNotice] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/cabinet/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password }),
      });
      const data = (await res.json()) as { status?: string };
      if (data.status === "ok") {
        window.location.replace("/cabinet");
      } else {
        setFormError("Неверный код клиента или пароль");
        setSubmitting(false);
      }
    } catch {
      setFormError("Ошибка соединения. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  };

  const auth = useCallback(async (attempt = 0) => {
    const wa = window.Telegram?.WebApp;
    if (!wa) {
      if (attempt < 12) {
        setTimeout(() => auth(attempt + 1), 200);
      } else {
        setState("browser-login");
      }
      return;
    }
    wa.ready();
    wa.expand();

    // В обычном браузере initData пустой → показываем вход через виджет
    if (!wa.initData) {
      setState("browser-login");
      return;
    }

    try {
      const res = await fetch("/api/cabinet/telegram-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: wa.initData }),
      });
      const data = (await res.json()) as { status?: string };
      if (data.status === "ok") {
        window.location.replace("/cabinet");
      } else if (data.status === "need-link") {
        setState("need-link");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("e");
    if (e === "notlinked") {
      setNotice("Этот Telegram ещё не привязан к аккаунту. Сначала подтвердите номер в боте.");
    } else if (e === "bad") {
      setNotice("Не удалось проверить вход. Попробуйте ещё раз.");
    }
    auth();
  }, [auth]);

  return (
    <main className="tg">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />

      <div className="tg-card">
        {state === "loading" && (
          <>
            <div className="tg-spinner" />
            <p className="tg-title">Входим в кабинет…</p>
          </>
        )}

        {state === "browser-login" && (
          <>
            <Image src="/brand/favicon.png" alt="PostmanFox" width={60} height={60} className="tg-logo" priority />
            <h1 className="tg-title">Вход в кабинет</h1>
            <p className="tg-sub">Войдите по коду клиента и паролю.</p>
            {notice && <p className="tg-notice">{notice}</p>}

            <form className="tg-form" onSubmit={submitPassword}>
              <input
                className="tg-input"
                type="text"
                placeholder="Код клиента"
                autoComplete="username"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <input
                className="tg-input"
                type="password"
                placeholder="Пароль"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {formError && <p className="tg-error">{formError}</p>}
              <button type="submit" className="tg-btn" disabled={submitting}>
                {submitting ? "Входим…" : "Войти"}
              </button>
            </form>

            <div className="tg-or"><span>или</span></div>

            {BOT && (
              <a className="tg-tgbtn" href={`https://t.me/${BOT}`}>
                <Send size={18} />
                Войти через Telegram
              </a>
            )}
          </>
        )}

        {state === "need-link" && (
          <>
            <span className="tg-emoji">📱</span>
            <h1 className="tg-title">Подтвердите номер</h1>
            <p className="tg-sub">
              Чтобы войти, вернитесь в чат бота и нажмите кнопку
              <b> «Поделиться номером»</b>. Мы найдём вас по телефону и привяжем аккаунт.
            </p>
            {BOT && (
              <a className="tg-btn" href={`https://t.me/${BOT}`}>
                Открыть чат бота
              </a>
            )}
            <button
              type="button"
              className="tg-btn tg-btn--ghost"
              onClick={() => window.Telegram?.WebApp?.close?.()}
            >
              Закрыть
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <span className="tg-emoji">⚠️</span>
            <h1 className="tg-title">Что-то пошло не так</h1>
            <p className="tg-sub">Попробуйте обновить страницу или войти из чата бота{BOT ? ` @${BOT}` : ""}.</p>
          </>
        )}
      </div>

      <style>{`
        .tg {
          min-height: 100dvh; display: flex; align-items: center; justify-content: center;
          padding: 24px; background: #f4f7f0; color: #1d2718;
          font-family: var(--font-inter), system-ui, sans-serif;
        }
        .tg-card {
          width: 100%; max-width: 360px; display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 12px; padding: 32px 24px; border-radius: 24px;
          background: #fff; border: 1px solid rgba(29,39,24,0.09); box-shadow: 0 8px 24px rgba(29,39,24,0.08);
        }
        .tg-emoji { font-size: 40px; }
        .tg-logo { width: 60px; height: 60px; object-fit: contain; }
        .tg-title { margin: 0; font-size: 20px; font-weight: 700; }
        .tg-sub { margin: 0; font-size: 14px; line-height: 1.5; color: #79836f; }
        .tg-notice {
          margin: 0; width: 100%; padding: 10px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4;
          color: #8a5a00; background: rgba(240,180,41,0.14); border: 1px solid rgba(240,180,41,0.3);
        }
        .tg-form { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
        .tg-input {
          width: 100%; padding: 13px 14px; border-radius: 14px; font-size: 15px;
          color: #1d2718; background: #f4f7f0; border: 1px solid rgba(29,39,24,0.12);
          outline: none; transition: border-color 0.15s, background 0.15s;
        }
        .tg-input:focus { border-color: #6dab3c; background: #fff; }
        .tg-error { margin: 0; font-size: 13px; color: #d64545; text-align: left; }
        .tg-or {
          display: flex; align-items: center; gap: 10px; width: 100%; margin: 4px 0;
          color: #79836f; font-size: 12px;
        }
        .tg-or::before, .tg-or::after { content: ''; flex: 1; height: 1px; background: rgba(29,39,24,0.1); }
        .tg-tgbtn {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          padding: 13px; border-radius: 14px; font-size: 15px; font-weight: 700;
          text-decoration: none; color: #fff; background: #229ED9;
          transition: background 0.15s;
        }
        .tg-tgbtn:hover { background: #1b8ec2; }
        .tg-btn:disabled { opacity: 0.6; cursor: default; }
        .tg-btn {
          width: 100%; margin-top: 6px; padding: 13px; border-radius: 14px; border: none; cursor: pointer;
          font-size: 15px; font-weight: 700; text-decoration: none; text-align: center; color: #fff;
          background: linear-gradient(150deg, #6dab3c, #4e8a2a);
        }
        .tg-btn--ghost { background: transparent; color: #79836f; font-weight: 600; }
        .tg-spinner {
          width: 36px; height: 36px; border-radius: 50%;
          border: 3px solid rgba(109,171,60,0.25); border-top-color: #6dab3c;
          animation: tg-spin 0.8s linear infinite;
        }
        @keyframes tg-spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
