import type { Metadata } from "next";
import Image from "next/image";
import Script from "next/script";
import { Eye, LogOut } from "lucide-react";
import { clientLogout, exitClientCabinet } from "@/actions/client-cabinet";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import CabinetNav from "@/components/cabinet/cabinet-nav";
import CabinetSidebar from "@/components/cabinet/cabinet-sidebar";
import TelegramInit from "@/components/cabinet/telegram-init";

export const metadata: Metadata = {
  title: "Кабинет клиента",
};

export default async function ClientCabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mode } = await getClientCabinetContext();
  const isAdminView = mode === "admin";

  return (
    <div className="cab-root">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <TelegramInit />
      <CabinetSidebar mode={mode} />

      <div className="cab-viewport">
        <header className="cab-header">
          <a
            href="https://postmanfox.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="cab-brand"
            aria-label="Перейти на postmanfox.com"
          >
            <Image
              src="/brand/logo.png"
              alt="PostmanFox"
              width={150}
              height={49}
              priority
              className="cab-brand-img"
            />
          </a>

          <form
            action={isAdminView ? exitClientCabinet : clientLogout}
            className={`cab-exit-form${isAdminView ? " cab-admin" : ""}`}
          >
            {isAdminView && (
              <span className="cab-mode-pill" title="Режим просмотра клиента">
                <Eye size={13} aria-hidden="true" />
                Просмотр
              </span>
            )}
            <button
              type="submit"
              className="cab-exit-btn"
              aria-label={isAdminView ? "Выйти из режима просмотра" : "Выйти"}
              title={isAdminView ? "Выйти из режима просмотра" : "Выйти"}
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          </form>
        </header>

        <main className="cab-main">{children}</main>

        <CabinetNav />
      </div>

      <style>{`
        .cab-root {
          --cab-bg: #f4f7f0;
          --cab-surface: #ffffff;
          --cab-surface-glass: rgba(255, 255, 255, 0.74);
          --cab-text: #1d2718;
          --cab-text-soft: #3c4a32;
          --cab-muted: #79836f;
          --cab-border: rgba(29, 39, 24, 0.09);
          --cab-border-strong: rgba(29, 39, 24, 0.16);

          --cab-green: #6dab3c;
          --cab-green-deep: #4e8a2a;
          --cab-orange: #e8730e;
          --cab-orange-light: #f39a1f;
          --cab-blue: #5472d2;
          --cab-mint: #75d69c;
          --cab-amber: #f0b429;
          --cab-danger: #d64545;

          --cab-shadow-sm: 0 2px 8px rgba(29, 39, 24, 0.06);
          --cab-shadow-md: 0 8px 24px rgba(29, 39, 24, 0.08);
          --cab-shadow-lg: 0 16px 40px rgba(29, 39, 24, 0.12);

          --cab-radius-lg: 24px;
          --cab-radius-md: 18px;
          --cab-radius-sm: 12px;

          display: flex;
          min-height: 100dvh;
          background:
            radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--cab-mint) 22%, transparent) 0%, transparent 42%),
            radial-gradient(120% 80% at 0% 100%, color-mix(in srgb, var(--cab-orange-light) 14%, transparent) 0%, transparent 45%),
            var(--cab-bg);
          color: var(--cab-text);
          font-family: var(--font-inter), system-ui, sans-serif;
        }

        .cab-viewport {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          min-height: 100dvh;
          max-width: 540px;
          margin: 0 auto;
        }

        .cab-header {
          position: sticky;
          top: 0;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          background: linear-gradient(to bottom, var(--cab-bg) 60%, transparent);
        }
        .cab-brand { display: inline-flex; }
        .cab-brand-img { height: 34px; width: auto; }

        .cab-exit-form { display: inline-flex; align-items: center; gap: 8px; }
        /* В Telegram Mini App есть нативная кнопка «Закрыть» — прячем дублирующую
           кнопку выхода. В admin-режиме «Просмотр» оставляем: нативная кнопка не
           возвращает админа из просмотра клиента обратно в админку. */
        html[data-telegram="1"] .cab-exit-form:not(.cab-admin) { display: none; }
        .cab-mode-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--cab-orange);
          background: color-mix(in srgb, var(--cab-orange) 12%, var(--cab-surface));
          border: 1px solid color-mix(in srgb, var(--cab-orange) 22%, transparent);
        }
        .cab-exit-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid var(--cab-border);
          background: var(--cab-surface);
          color: var(--cab-muted);
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .cab-exit-btn:hover { color: var(--cab-danger); border-color: color-mix(in srgb, var(--cab-danger) 40%, transparent); }

        .cab-main {
          flex: 1;
          padding: 6px 18px 8px;
        }

        .cab-brand:focus-visible,
        .cab-exit-btn:focus-visible {
          outline: 2px solid var(--cab-green);
          outline-offset: 2px;
        }

        @media (min-width: 1024px) {
          .cab-viewport {
            max-width: 1400px;
            margin: 0;
            padding: 0 32px;
          }
          .cab-header { display: none; }
          .cab-main { padding: 28px 0 40px; }
        }
      `}</style>
    </div>
  );
}
