"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  ClipboardList,
  Eye,
  LayoutGrid,
  LogOut,
  Package,
  Plus,
  User,
  Users,
} from "lucide-react";
import { clientLogout, exitClientCabinet } from "@/actions/client-cabinet";
import type { ClientCabinetMode } from "@/lib/client-cabinet";

type Item = { href: string; label: string; icon: typeof LayoutGrid };

// Основная навигация — сверху
const PRIMARY: Item[] = [
  { href: "/cabinet", label: "Обзор", icon: LayoutGrid },
  { href: "/cabinet/orders", label: "Заказы", icon: ClipboardList },
  { href: "/cabinet/parcels", label: "Посылки", icon: Package },
];

// Под разделительной линией
const SECONDARY: Item[] = [
  { href: "/cabinet/recipients", label: "Получатели", icon: Users },
];

// Прижато к низу сайдбара
const BOTTOM: Item[] = [
  { href: "/cabinet/tariffs", label: "Тарифы", icon: BadgeDollarSign },
  { href: "/cabinet/profile", label: "Профиль", icon: User },
];

export default function CabinetSidebar({ mode }: { mode: ClientCabinetMode }) {
  const pathname = usePathname();
  const isAdminView = mode === "admin";
  const isActive = (href: string) =>
    href === "/cabinet" ? pathname === "/cabinet" : pathname.startsWith(href);

  return (
    <aside className="cs">
      <div className="cs-top">
        <a
          href="https://postmanfox.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="cs-brand"
          aria-label="Перейти на postmanfox.com"
        >
          <Image src="/brand/logo.png" alt="PostmanFox" width={150} height={49} priority className="cs-brand-img" />
        </a>
        {isAdminView && (
          <span className="cs-mode" title="Режим просмотра клиента">
            <Eye size={12} aria-hidden="true" />
            Просмотр
          </span>
        )}
      </div>

      <span className="cs-new cs-new--off" aria-disabled="true" title="Скоро">
        <Plus size={18} strokeWidth={2.5} />
        Оформить заказ
      </span>

      <nav className="cs-nav" aria-label="Навигация кабинета">
        <div className="cs-group">
          {PRIMARY.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`cs-link ${isActive(href) ? "cs-link--active" : ""}`}
            >
              <Icon size={18} className="cs-link-icon" />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        <div className="cs-divider" aria-hidden="true" />

        <div className="cs-group">
          {SECONDARY.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`cs-link ${isActive(href) ? "cs-link--active" : ""}`}
            >
              <Icon size={18} className="cs-link-icon" />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        <div className="cs-spacer" />

        <div className="cs-group">
          {BOTTOM.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`cs-link ${isActive(href) ? "cs-link--active" : ""}`}
            >
              <Icon size={18} className="cs-link-icon" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <form action={isAdminView ? exitClientCabinet : clientLogout} className="cs-exit-form">
        <button type="submit" className="cs-exit">
          <LogOut size={16} />
          {isAdminView ? "Выйти из просмотра" : "Выйти"}
        </button>
      </form>

      <style>{`
        .cs {
          display: none;
          position: sticky;
          top: 0;
          width: 264px;
          flex-shrink: 0;
          height: 100dvh;
          flex-direction: column;
          gap: 14px;
          padding: 22px 16px;
          background: var(--cab-surface-glass);
          backdrop-filter: blur(20px) saturate(1.6);
          border-right: 1px solid var(--cab-border);
        }

        .cs-top { display: flex; flex-direction: column; gap: 12px; padding: 0 6px; }
        .cs-brand { display: inline-flex; }
        .cs-brand-img { height: 36px; width: auto; }
        .cs-mode {
          align-self: flex-start; display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
          color: var(--cab-orange);
          background: color-mix(in srgb, var(--cab-orange) 12%, var(--cab-surface));
          border: 1px solid color-mix(in srgb, var(--cab-orange) 22%, transparent);
        }

        .cs-new {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px; border-radius: var(--cab-radius-md); font-size: 14px; font-weight: 700;
          color: #fff; text-decoration: none;
          background: linear-gradient(150deg, var(--cab-green) 0%, var(--cab-green-deep) 100%);
          box-shadow: 0 8px 20px color-mix(in srgb, var(--cab-green) 36%, transparent);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .cs-new:hover { transform: translateY(-2px); box-shadow: 0 12px 26px color-mix(in srgb, var(--cab-green) 42%, transparent); }
        .cs-new--off { opacity: 0.45; pointer-events: none; box-shadow: none; }

        .cs-nav { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .cs-group { display: flex; flex-direction: column; gap: 2px; }
        .cs-divider { height: 1px; margin: 4px 8px; background: var(--cab-border); }
        .cs-spacer { flex: 1; }
        .cs-link {
          display: flex; align-items: center; gap: 11px; padding: 10px 12px;
          border-radius: var(--cab-radius-sm); font-size: 13.5px; font-weight: 600;
          color: var(--cab-text-soft); text-decoration: none; position: relative;
          transition: color 0.15s, background 0.15s;
        }
        .cs-link:hover { color: var(--cab-text); background: color-mix(in srgb, var(--cab-green) 7%, transparent); }
        .cs-link--active { color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-green) 11%, transparent); }
        .cs-link--active::before {
          content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px;
          border-radius: 0 2px 2px 0; background: var(--cab-green);
        }
        .cs-link-icon { flex-shrink: 0; }

        .cs-exit-form { display: flex; }
        .cs-exit {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 11px; border-radius: var(--cab-radius-sm); font-size: 13px; font-weight: 600; cursor: pointer;
          color: var(--cab-muted); background: var(--cab-surface); border: 1px solid var(--cab-border);
          transition: color 0.15s, border-color 0.15s;
        }
        .cs-exit:hover { color: var(--cab-danger); border-color: color-mix(in srgb, var(--cab-danger) 40%, transparent); }

        @media (min-width: 1024px) {
          .cs { display: flex; }
        }
      `}</style>
    </aside>
  );
}
