import type { Metadata } from "next";
import { Eye, LogOut } from "lucide-react";
import { exitClientCabinet } from "@/actions/client-cabinet";
import { BrandLogo } from "@/components/ui/brand-logo";

export const metadata: Metadata = {
  title: "Кабинет клиента",
};

export default function ClientCabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="client-cabinet-shell">
      <header className="client-cabinet-header">
        <a
          href="https://postmanfox.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="client-cabinet-brand"
          aria-label="Перейти на postmanfox.com"
        >
          <BrandLogo size="sm" />
        </a>

        <span className="client-cabinet-header-label">
          <Eye size={15} aria-hidden="true" />
          Кабинет клиента
        </span>
      </header>

      <div className="client-cabinet-banner-wrap">
        <aside className="client-cabinet-banner" aria-label="Режим просмотра клиента">
          <div className="client-cabinet-banner-copy">
            <span className="client-cabinet-banner-icon" aria-hidden="true">
              <Eye size={18} />
            </span>
            <div>
              <strong>Режим просмотра клиента</strong>
              <p>
                Вы видите кабинет так, как его видит клиент. Административные
                действия недоступны.
              </p>
            </div>
          </div>

          <form action={exitClientCabinet}>
            <button type="submit" className="client-cabinet-exit-button">
              <LogOut size={15} aria-hidden="true" />
              Выйти из режима просмотра
            </button>
          </form>
        </aside>
      </div>

      <main className="client-cabinet-main">{children}</main>

      <style>{`
        .client-cabinet-shell {
          min-height: 100dvh;
        }

        .client-cabinet-header {
          min-height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 32px;
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border-bottom: 1px solid var(--color-border);
        }

        .client-cabinet-brand {
          display: inline-flex;
          color: inherit;
          text-decoration: none;
        }

        .client-cabinet-header-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 10px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          color: var(--color-muted);
          background: var(--color-muted-bg);
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .client-cabinet-banner-wrap {
          max-width: 1240px;
          margin: 0 auto;
          padding: 20px 32px 0;
        }

        .client-cabinet-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 14px 16px;
          border: 1px solid color-mix(in srgb, var(--color-accent) 32%, var(--color-border));
          border-radius: var(--radius-md);
          background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
          box-shadow: var(--shadow-card);
        }

        .client-cabinet-banner-copy {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
        }

        .client-cabinet-banner-icon {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: var(--radius-sm);
          color: var(--color-accent);
          background: color-mix(in srgb, var(--color-accent) 14%, transparent);
        }

        .client-cabinet-banner strong {
          display: block;
          color: var(--color-text);
          font-size: 13.5px;
          font-weight: 700;
        }

        .client-cabinet-banner p {
          margin: 3px 0 0;
          color: var(--color-muted);
          font-size: 12.5px;
          line-height: 1.45;
        }

        .client-cabinet-exit-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 36px;
          padding: 8px 13px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: var(--color-text);
          background: var(--color-surface);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          white-space: nowrap;
        }

        .client-cabinet-exit-button:hover {
          color: var(--color-accent);
          background: var(--color-muted-bg);
          border-color: var(--color-border-strong);
        }

        .client-cabinet-exit-button:focus-visible,
        .client-cabinet-brand:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .client-cabinet-main {
          max-width: 1240px;
          margin: 0 auto;
          padding: 24px 32px 48px;
        }

        @media (max-width: 768px) {
          .client-cabinet-header {
            padding: 12px 16px;
          }

          .client-cabinet-banner-wrap {
            padding: 16px 16px 0;
          }

          .client-cabinet-banner {
            align-items: stretch;
            flex-direction: column;
            gap: 12px;
          }

          .client-cabinet-exit-button {
            width: 100%;
          }

          .client-cabinet-main {
            padding: 20px 16px 36px;
          }
        }
      `}</style>
    </div>
  );
}
