"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  ChevronDown,
  ClipboardList,
  CircleDollarSign,
  Database,
  Globe,
  IdCard,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  Receipt,
  Settings,
  Sparkles,
  Tags,
  Users,
  Wrench,
  Workflow,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { USER_ROLE_LABELS } from "@/types";
import type { UserRole } from "@prisma/client";
import { BrandLogo } from "@/components/ui/brand-logo";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
};
type NavGroup = { title: string; items: NavItem[] };

// Прямая ссылка (рабочий стол), вне панели «Данные»
const HOME: NavItem = { href: "/dashboard", label: "Операции", icon: LayoutDashboard };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Документы",
    items: [
      { href: "/orders", label: "Заказы", icon: ClipboardList },
      { href: "/receiving", label: "Приёмка (АРМ)", icon: PackageCheck },
      { href: "/parcels", label: "Посылки", icon: Package },
    ],
  },
  {
    title: "Справочники",
    items: [
      { href: "/clients", label: "Клиенты", icon: IdCard },
      { href: "/recipients", label: "Получатели", icon: Users },
      { href: "/product-names", label: "Наименования", icon: Tags },
      { href: "/countries", label: "Страны", icon: Globe },
      { href: "/statuses", label: "Статусы", icon: Workflow },
      { href: "/services", label: "Услуги", icon: Sparkles },
      { href: "/tariffs", label: "Тарифы", icon: BadgeDollarSign },
    ],
  },
  {
    title: "Регистры",
    items: [
      { href: "/finance", label: "Курс", icon: CircleDollarSign },
      { href: "/finance?tab=payments", label: "Расчёт и оплата", icon: Receipt },
    ],
  },
  {
    title: "Обработки",
    items: [{ href: "#", label: "Скоро", icon: Wrench, soon: true }],
  },
  {
    title: "Отчёты",
    items: [{ href: "#", label: "Скоро", icon: BarChart3, soon: true }],
  },
];

type TopNavProps = {
  userName: string;
  userRole: string;
};

export default function TopNav({ userName, userRole }: TopNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dataRef = useRef<HTMLDivElement>(null);

  const roleLabel = USER_ROLE_LABELS[userRole as UserRole] ?? userRole;

  const itemActive = (href: string) => {
    const path = href.split("?")[0];
    return pathname === path || pathname.startsWith(path + "/");
  };
  const dataActive = NAV_GROUPS.some((g) => g.items.some((i) => !i.soon && itemActive(i.href)));

  // Закрытие панели «Данные»: клик вне и Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dataRef.current && !dataRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Закрытие при переходе на новую страницу
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <a
          href="https://postmanfox.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="topnav-brand"
          aria-label="Перейти на postmanfox.com"
        >
          <BrandLogo size="sm" />
        </a>

        <nav className="topnav-menu" aria-label="Разделы">
          <Link
            href={HOME.href}
            className={cn("topnav-link", itemActive(HOME.href) && "topnav-link--active")}
          >
            <HOME.icon size={16} />
            <span>{HOME.label}</span>
          </Link>

          <div className="topnav-data" ref={dataRef}>
            <button
              type="button"
              className={cn("topnav-link topnav-trigger", (open || dataActive) && "topnav-link--active")}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <Database size={16} />
              <span>Данные</span>
              <ChevronDown
                size={14}
                className="topnav-caret"
                style={{ transform: open ? "rotate(180deg)" : "none" }}
              />
            </button>

            {open && (
              <div className="topnav-panel" role="menu">
                <div className="topnav-panel-inner">
                  {NAV_GROUPS.map((group) => (
                    <div key={group.title} className="topnav-section">
                      <p className="topnav-section-title">{group.title}</p>
                      <div className="topnav-section-items">
                        {group.items.map(({ href, label, icon: Icon, soon }) =>
                          soon ? (
                            <span key={label} className="topnav-item topnav-item--soon" aria-disabled="true">
                              <Icon size={16} />
                              <span>{label}</span>
                            </span>
                          ) : (
                            <Link
                              key={href}
                              href={href}
                              role="menuitem"
                              className={cn("topnav-item", itemActive(href) && "topnav-item--active")}
                            >
                              <Icon size={16} />
                              <span>{label}</span>
                            </Link>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className="topnav-right">
          <Link
            href="/settings"
            className={cn("topnav-icon-link", itemActive("/settings") && "topnav-link--active")}
            title="Настройки"
            aria-label="Настройки"
          >
            <Settings size={18} />
          </Link>

          <div className="topnav-user">
            <div className="topnav-avatar">{userName.charAt(0).toUpperCase()}</div>
            <div className="topnav-user-info">
              <span className="topnav-user-name">{userName}</span>
              <span className="topnav-user-role">{roleLabel}</span>
            </div>
            <button
              type="button"
              className="topnav-logout"
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Выйти"
              title="Выйти"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .topnav {
          position: sticky;
          top: 0;
          z-index: 30;
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border-bottom: 1px solid var(--color-border);
        }
        .topnav-inner {
          display: flex;
          align-items: center;
          gap: 16px;
          height: 56px;
          padding: 0 20px;
          max-width: 1600px;
          margin: 0 auto;
        }
        .topnav-brand { display: inline-flex; align-items: center; flex-shrink: 0; text-decoration: none; }

        .topnav-menu { display: flex; align-items: center; gap: 2px; flex: 1; min-width: 0; }

        .topnav-link {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 12px; border-radius: var(--radius-sm);
          font-size: 13.5px; font-weight: 500; color: var(--color-text-secondary);
          text-decoration: none; background: none; border: none; cursor: pointer;
          white-space: nowrap; transition: color 0.15s, background 0.15s;
        }
        .topnav-link:hover { color: var(--color-text); background: var(--color-muted-bg); }
        .topnav-link--active { color: var(--color-accent); background: oklch(52% 0.14 42 / 0.08); }

        .topnav-data { position: relative; }
        .topnav-trigger { gap: 6px; }
        .topnav-caret { transition: transform 0.18s ease; flex-shrink: 0; }

        .topnav-panel {
          position: fixed; top: 56px; left: 0; right: 0; z-index: 29;
          background: #fffcf6;
          border-bottom: 1px solid var(--color-border);
          box-shadow: 0 16px 40px rgba(29, 39, 24, 0.16);
          max-height: calc(100dvh - 56px); overflow-y: auto;
          animation: topnav-pop 0.14s ease;
        }
        @keyframes topnav-pop {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .topnav-panel-inner {
          max-width: 1600px; margin: 0 auto; padding: 22px 20px;
          display: grid; grid-template-columns: repeat(5, 1fr); gap: 22px; align-items: start;
        }
        .topnav-section { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .topnav-section-items { display: flex; flex-direction: column; gap: 2px; }
        .topnav-section-title {
          margin: 0; padding: 2px 10px 8px; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted);
          border-bottom: 1px solid var(--color-border);
        }

        @media (max-width: 1024px) {
          .topnav-panel-inner { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 640px) {
          .topnav-panel-inner { grid-template-columns: 1fr; gap: 14px; }
        }

        .topnav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: var(--radius-sm);
          font-size: 13.5px; font-weight: 500; color: var(--color-text-secondary);
          text-decoration: none; white-space: nowrap; transition: color 0.15s, background 0.15s;
        }
        .topnav-item:hover { color: var(--color-text); background: var(--color-muted-bg); }
        .topnav-item--active { color: var(--color-accent); background: oklch(52% 0.14 42 / 0.08); }
        .topnav-item--soon { color: var(--color-muted); opacity: 0.55; cursor: default; pointer-events: none; }
        .topnav-item svg { flex-shrink: 0; }

        .topnav-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto; }
        .topnav-icon-link {
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: var(--radius-sm);
          color: var(--color-text-secondary); text-decoration: none; transition: color 0.15s, background 0.15s;
        }
        .topnav-icon-link:hover { color: var(--color-text); background: var(--color-muted-bg); }

        .topnav-user { display: flex; align-items: center; gap: 10px; padding-left: 8px; border-left: 1px solid var(--color-border); }
        .topnav-avatar {
          width: 32px; height: 32px; flex-shrink: 0;
          background: oklch(52% 0.14 42 / 0.15); color: var(--color-accent);
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 600;
        }
        .topnav-user-info { display: flex; flex-direction: column; min-width: 0; }
        .topnav-user-name { font-size: 13px; font-weight: 500; color: var(--color-text); white-space: nowrap; }
        .topnav-user-role { font-size: 11px; color: var(--color-muted); white-space: nowrap; }
        .topnav-logout {
          background: none; border: none; cursor: pointer; color: var(--color-muted);
          padding: 6px; display: flex; align-items: center; border-radius: var(--radius-sm);
          transition: color 0.15s, background 0.15s;
        }
        .topnav-logout:hover { color: var(--color-danger); background: var(--color-danger-bg); }

        @media (max-width: 1024px) {
          .topnav-user-info { display: none; }
        }
      `}</style>
    </header>
  );
}
