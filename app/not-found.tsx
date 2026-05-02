import Link from "next/link";

export default function NotFound() {
  return (
    <div className="error-page">
      <div className="error-code">404</div>
      <h1 className="error-title">Страница не найдена</h1>
      <p className="error-desc">Запрошенная страница не существует или была удалена.</p>
      <Link href="/dashboard" className="btn-primary">
        На главную
      </Link>

      <style>{`
        .error-page {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 32px;
          text-align: center;
          background: var(--color-bg);
        }
        .error-code {
          font-size: 80px;
          font-weight: 800;
          color: var(--color-border);
          line-height: 1;
          font-family: var(--font-display);
        }
        .error-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0;
        }
        .error-desc {
          font-size: 14px;
          color: var(--color-muted);
          margin: 0;
          max-width: 360px;
        }
        .btn-primary {
          display: inline-flex;
          align-items: center;
          padding: 10px 20px;
          background: var(--color-accent);
          color: var(--color-accent-fg);
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          margin-top: 8px;
          transition: background 0.15s;
        }
        .btn-primary:hover { background: var(--color-accent-hover); }
      `}</style>
    </div>
  );
}
