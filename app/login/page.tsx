import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Вход",
};

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span>АП</span>
          </div>
          <h1 className="login-title">Добро пожаловать</h1>
          <p className="login-subtitle">Войдите в систему управления магазином</p>
        </div>
        <LoginForm />
      </div>

      <style>{`
        .login-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--color-bg);
          background-image: radial-gradient(
            ellipse 80% 60% at 50% -10%,
            oklch(52% 0.14 42 / 0.08),
            transparent
          );
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 40px;
          box-shadow: var(--shadow-modal);
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo {
          width: 56px;
          height: 56px;
          background: var(--color-accent);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: var(--color-accent-fg);
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.5px;
        }

        .login-title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 6px;
          color: var(--color-text);
        }

        .login-subtitle {
          font-size: 13px;
          color: var(--color-muted);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
