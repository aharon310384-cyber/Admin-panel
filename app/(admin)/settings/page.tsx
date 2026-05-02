import type { Metadata } from "next";
import { auth } from "@/auth";
import ChangePasswordForm from "./change-password-form";

export const metadata: Metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const session = await auth();

  const { USER_ROLE_LABELS } = await import("@/types");

  return (
    <div className="page">
      <h1 className="page-title">Настройки</h1>

      <div className="settings-grid">
        {/* Информация об аккаунте */}
        <div className="card">
          <h2 className="card-title">Мой аккаунт</h2>
          <div className="account-info">
            <div className="account-avatar">
              {session?.user.name?.charAt(0).toUpperCase()}
            </div>
            <dl className="info-list">
              <div className="info-row">
                <dt>Имя</dt>
                <dd>{session?.user.name}</dd>
              </div>
              <div className="info-row">
                <dt>Email</dt>
                <dd>{session?.user.email}</dd>
              </div>
              <div className="info-row">
                <dt>Роль</dt>
                <dd>
                  <span className={`role-badge role-badge--${session?.user.role?.toLowerCase()}`}>
                    {session?.user.role
                      ? USER_ROLE_LABELS[session.user.role as "ADMIN" | "MANAGER"]
                      : "—"}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Смена пароля */}
        <div className="card">
          <h2 className="card-title">Сменить пароль</h2>
          <ChangePasswordForm />
        </div>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }

        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; box-shadow: var(--shadow-card); }
        .card-title { font-size: 15px; font-weight: 600; margin: 0 0 20px; color: var(--color-text); }

        .account-info { display: flex; gap: 16px; }
        .account-avatar { width: 56px; height: 56px; background: oklch(52% 0.14 42 / 0.12); color: var(--color-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; flex-shrink: 0; }

        .info-list { display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .info-row { display: flex; gap: 12px; font-size: 13px; }
        .info-row dt { width: 60px; flex-shrink: 0; color: var(--color-muted); }
        .info-row dd { flex: 1; color: var(--color-text); margin: 0; }

        .role-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-full); font-size: 11px; font-weight: 500; }
        .role-badge--admin { background: oklch(52% 0.14 42 / 0.12); color: var(--color-accent); }
        .role-badge--manager { background: var(--color-status-new-bg); color: var(--color-status-new); }

        @media (max-width: 768px) { .settings-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
