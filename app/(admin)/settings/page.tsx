import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import InterfaceMenu from "@/components/settings/interface-menu";
import { getUserInterface } from "@/lib/interface-settings";
import ChangePasswordForm from "./change-password-form";
import Form from "@/components/form/form";
import TrackingSettings from "@/components/settings/tracking-settings";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const session = await auth();
  const { panels } = session ? await getUserInterface(session.user.id) : { panels: undefined };

  const { USER_ROLE_LABELS } = await import("@/types");

  const shipped = { parcel: { status: "SHIPPED" as const, deletedAt: null } };
  const [tracking, tracked, problems] = await Promise.all([
    prisma.trackingSettings.findFirst(),
    prisma.parcelTracking.count({ where: { ...shipped, registeredAt: { not: null } } }),
    prisma.parcelTracking.count({ where: { ...shipped, problem: true } }),
  ]);

  return (
    <>
      <Form formKey="settings" title="Настройки">
        <div className="settings-grid">
          <div className="settings-col">
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

            {/* Интерфейс */}
            <div className="card">
              <h2 className="card-title">Интерфейс</h2>
              {panels && <InterfaceMenu panels={panels} />}
            </div>

            <div className="card">
              <h2 className="card-title">Компании</h2>
              <p className="settings-text">
                Название, логотип, сайт и тексты Telegram: чей бренд в админке, а чей — в кабинете клиента.
              </p>
              <Link href="/companies" className="settings-link">Открыть «Компании» →</Link>
            </div>
          </div>

          <div className="settings-col">
            {/* Смена пароля */}
            <div className="card">
              <h2 className="card-title">Сменить пароль</h2>
              <ChangePasswordForm />
            </div>

            <div className="card">
              <h2 className="card-title">Отслеживание посылок (17TRACK)</h2>
              <TrackingSettings
                options={{
                  lang: tracking?.lang ?? "ru",
                  fallbackPrefixes: tracking?.fallbackPrefixes ?? "",
                  fallbackCarrier: tracking?.fallbackCarrier ?? null,
                  fallbackCarrierName: tracking?.fallbackCarrierName ?? null,
                  fallbackAfterHours: tracking?.fallbackAfterHours ?? 24,
                }}
                keyTail={tracking?.apiKey ? tracking.apiKey.slice(-4) : null}
                isAdmin={session?.user.role === "ADMIN"}
                lastSyncAt={tracking?.lastSyncAt ? formatDateTime(tracking.lastSyncAt) : null}
                lastSync={tracking?.lastSync ?? null}
                tracked={tracked}
                problems={problems}
              />
            </div>
          </div>
        </div>
      </Form>

      <style>{`
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
        .settings-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px 16px; box-shadow: var(--shadow-card); }
        .card-title { font-size: 15px; font-weight: 600; margin: 0 0 20px; color: var(--color-text); }
        .settings-text { margin: 0 0 10px; font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); }
        .settings-link { font-size: 13px; font-weight: 500; color: var(--color-accent); text-decoration: none; }
        .settings-link:hover { text-decoration: underline; }

        .account-info { display: flex; gap: 16px; }
        .account-avatar { width: 56px; height: 56px; background: oklch(52% 0.14 42 / 0.12); color: var(--color-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; flex-shrink: 0; }

        .info-list { display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .info-row { display: flex; gap: 12px; font-size: 13px; }
        .info-row dt { width: 60px; flex-shrink: 0; color: var(--color-muted); }
        .info-row dd { flex: 1; color: var(--color-text); margin: 0; }

        .role-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-full); font-size: 11px; font-weight: 500; }
        .role-badge--admin { background: oklch(52% 0.14 42 / 0.12); color: var(--color-accent); }
        .role-badge--manager { background: var(--color-status-new-bg); color: var(--color-status-new); }

        .ui-menu { list-style: none; margin: 0; padding: 0; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; }
        .ui-menu-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 14px; font-size: 14px; color: var(--color-text-secondary); cursor: default; }
        .ui-menu > li + li { border-top: 1px solid var(--color-border); }
        .ui-menu-item--action {
          width: 100%; border: none; background: none; font: inherit; font-size: 14px; text-align: left;
          color: var(--color-text); cursor: pointer; transition: background 0.15s;
        }
        .ui-menu-item--action:hover, .ui-menu-item--action:focus-visible { background: #f9c77a; outline: none; }
        .ui-menu-soon { flex-shrink: 0; padding: 2px 8px; border-radius: var(--radius-full); background: var(--color-muted-bg); color: var(--color-muted); font-size: 11px; font-weight: 500; }

        @media (max-width: 768px) { .settings-grid { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
}
