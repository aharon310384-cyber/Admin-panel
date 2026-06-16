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
  Globe,
  IdCard,
  LayoutDashboard,
  LogOut,
  Package,
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

// Прямая ссылка (без выпадающего меню)
const HOME: NavItem = { href: "/dashboard", label: "Операции", icon: LayoutDashboard };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Документы",
    items: [
      { href: "/orders", label: "Заказы", icon: ClipboardList },
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
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const roleLabel = USER_ROLE_LABELS[userRole as UserRole] ?? userRole;

  const itemActive = (href: string) => {
    const path = href.split("?")[0];
    return pathname === path || pathname.startsWith(path + "/");
  };
  const groupActive = (group: NavGroup) => group.items.some((i) => !i.soon && itemActive(i.href));

  // Закрытие по клику вне меню и по Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Закрытие при переходе на новую страницу
  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  return (
    <header className="topnav">
      <div className="topnav-inner" ref={navRef}>
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

          {NAV_GROUPS.map((group) => {
            const isOpen = open === group.title;
            return (
              <div key={group.title} className="topnav-group">
                <button
                  type="button"
                  className={cn(
                    "topnav-link topnav-trigger",
                    (isOpen || groupActive(group)) && "topnav-link--active"
                  )}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : group.title)}
                >
                  <span>{group.title}</span>
                  <ChevronDown
                    size={14}
                    className="topnav-caret"
                    style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                  />
                </button>

                {isOpen && (
                  <div className="topnav-dropdown" role="menu">
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
                )}
              </div>
            );
          })}
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

        .topnav-group { position: relative; }
        .topnav-trigger { gap: 5px; }
        .topnav-caret { transition: transform 0.18s ease; flex-shrink: 0; }

        .topnav-dropdown {
          position: absolute; top: calc(100% + 6px); left: 0;
          min-width: 220px; padding: 6px;
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius-md); box-shadow: var(--shadow-card);
          display: flex; flex-direction: column; gap: 2px;
          animation: topnav-pop 0.14s ease;
        }
        @keyframes topnav-pop {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
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
          .topnav-menu { overflow-x: auto; scrollbar-width: none; }
          .topnav-menu::-webkit-scrollbar { display: none; }
          .topnav-user-info { display: none; }
        }
      `}</style>
    </header>
  );
}
