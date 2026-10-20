import type { Metadata } from "next";
import LoginForm from "./login-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { siteLabel } from "@/lib/brand";
import { adminTabIcon, getAdminBrand } from "@/lib/company";

export async function generateMetadata(): Promise<Metadata> {
  const icon = await adminTabIcon();
  return { title: "Вход", icons: { icon, apple: icon } };
}

export default async function LoginPage() {
  const brand = await getAdminBrand();
  const logo = <BrandLogo name={brand.name} iconUrl={brand.iconUrl} size="lg" />;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          {brand.siteUrl ? (
            <a
              href={brand.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="login-brand"
              aria-label={`Перейти на ${siteLabel(brand.siteUrl)}`}
            >
              {logo}
            </a>
          ) : (
            <span className="login-brand">{logo}</span>
          )}
          <h1 className="login-title">Добро пожаловать</h1>
          <p className="login-subtitle">Войдите в админ-панель</p>
        </div>
        <LoginForm />
        {brand.siteUrl && (
          <a
            href={brand.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="login-site-link"
          >
            Перейти на {siteLabel(brand.siteUrl)} →
          </a>
        )}
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

        .login-brand {
          display: inline-flex;
          align-items: center;
          margin: 0 auto 24px;
          text-decoration: none;
          color: inherit;
        }

        .login-site-link {
          display: block;
          text-align: center;
          margin-top: 20px;
          font-size: 13px;
          color: var(--color-muted);
          text-decoration: none;
          transition: color 0.15s;
        }

        .login-site-link:hover {
          color: var(--color-accent);
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
