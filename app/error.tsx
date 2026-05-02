"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="error-page">
      <div className="error-icon">!</div>
      <h1 className="error-title">Что-то пошло не так</h1>
      <p className="error-desc">Произошла неожиданная ошибка. Попробуйте снова или вернитесь на главную.</p>
      <div className="error-actions">
        <button onClick={reset} className="btn-primary">
          Попробовать снова
        </button>
        <a href="/dashboard" className="btn-secondary">
          На главную
        </a>
      </div>

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
          background: var(--color-bg, #faf8f5);
        }
        .error-icon {
          width: 64px;
          height: 64px;
          background: var(--color-danger-bg, #fef2f2);
          color: var(--color-danger, #dc2626);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 700;
        }
        .error-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text, #1a1a1a);
          margin: 0;
        }
        .error-desc {
          font-size: 14px;
          color: var(--color-muted, #6b7280);
          margin: 0;
          max-width: 400px;
          line-height: 1.5;
        }
        .error-actions {
          display: flex;
          gap: 10px;
          margin-top: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .btn-primary {
          display: inline-flex;
          align-items: center;
          padding: 10px 20px;
          background: var(--color-accent, #bb5a2c);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          padding: 10px 20px;
          background: transparent;
          border: 1px solid var(--color-border, #e8e0d8);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text, #1a1a1a);
          text-decoration: none;
          transition: background 0.15s;
        }
        .btn-secondary:hover { background: var(--color-muted-bg, #f3f4f6); }
      `}</style>
    </div>
  );
}
