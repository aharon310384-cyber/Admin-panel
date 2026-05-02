"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { USER_ROLE_LABELS } from "@/types";
import type { UserRole } from "@prisma/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Операции", icon: LayoutDashboard },
  { href: "/orders", label: "Заказы", icon: Truck },
  { href: "/customers", label: "Получатели", icon: Users },
  { href: "/products", label: "Услуги", icon: PackageCheck },
];

type SidebarProps = {
  userName: string;
  userRole: string;
};

export default function Sidebar({ userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const roleLabel = USER_ROLE_LABELS[userRole as UserRole] ?? userRole;

  return (
    <aside className={cn("sidebar", collapsed && "sidebar--collapsed")}>
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <div className="sidebar-logo">PF</div>
          {!collapsed && <span className="sidebar-brand-name">PostmanFox</span>}
        </div>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed((v) => !v)}
          aria-label="Свернуть меню"
        >
          <ChevronLeft
            size={16}
            style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn("sidebar-link", isActive(href) && "sidebar-link--active")}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="sidebar-link-icon" />
            {!collapsed && <span>{label}</span>}
          </Link>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <Link
          href="/tariffs"
          className={cn("sidebar-link", isActive("/tariffs") && "sidebar-link--active")}
          title={collapsed ? "Тарифы" : undefined}
        >
          <BadgeDollarSign size={18} className="sidebar-link-icon" />
          {!collapsed && <span>Тарифы</span>}
        </Link>

        <Link
          href="/settings"
          className={cn("sidebar-link", isActive("/settings") && "sidebar-link--active")}
          title={collapsed ? "Настройки" : undefined}
        >
          <Settings size={18} className="sidebar-link-icon" />
          {!collapsed && <span>Настройки</span>}
        </Link>

        <div className={cn("sidebar-user", collapsed && "sidebar-user--collapsed")}>
          <div className="sidebar-avatar">
            {userName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{userName}</span>
              <span className="sidebar-user-role">{roleLabel}</span>
            </div>
          )}
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Выйти"
            title="Выйти"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <style>{`
        .sidebar {
          width: 240px;
          height: 100dvh;
          position: sticky;
          top: 0;
          display: flex;
          flex-direction: column;
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border-right: 1px solid var(--color-border);
          transition: width 0.2s ease;
          flex-shrink: 0;
          z-index: 10;
        }

        .sidebar--collapsed {
          width: 64px;
        }

        .sidebar-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 16px 16px;
          border-bottom: 1px solid var(--color-border);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
        }

        .sidebar-logo {
          width: 32px;
          height: 32px;
          background: var(--color-accent);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent-fg);
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }

        .sidebar-brand-name {
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          color: var(--color-text);
        }

        .sidebar-collapse-btn {
          background: none;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--color-muted);
          flex-shrink: 0;
          transition: color 0.15s, background 0.15s;
        }

        .sidebar-collapse-btn:hover {
          color: var(--color-text);
          background: var(--color-muted-bg);
        }

        .sidebar-nav {
          flex: 1;
          padding: 12px 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow-y: auto;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: var(--radius-sm);
          font-size: 13.5px;
          font-weight: 500;
          color: var(--color-text-secondary);
          text-decoration: none;
          transition: color 0.15s, background 0.15s;
          position: relative;
          white-space: nowrap;
          overflow: hidden;
        }

        .sidebar-link:hover {
          color: var(--color-text);
          background: var(--color-muted-bg);
        }

        .sidebar-link--active {
          color: var(--color-accent);
          background: oklch(52% 0.14 42 / 0.08);
        }

        .sidebar-link--active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 6px;
          bottom: 6px;
          width: 3px;
          background: var(--color-accent);
          border-radius: 0 2px 2px 0;
        }

        .sidebar-link-icon {
          flex-shrink: 0;
        }

        .sidebar-bottom {
          padding: 8px;
          border-top: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: var(--radius-sm);
          margin-top: 4px;
          overflow: hidden;
        }

        .sidebar-user--collapsed {
          justify-content: center;
          flex-direction: column;
          gap: 6px;
        }

        .sidebar-avatar {
          width: 32px;
          height: 32px;
          background: oklch(52% 0.14 42 / 0.15);
          color: var(--color-accent);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .sidebar-user-info {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .sidebar-user-name {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-user-role {
          display: block;
          font-size: 11px;
          color: var(--color-muted);
          white-space: nowrap;
        }

        .sidebar-logout-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-muted);
          padding: 4px;
          display: flex;
          align-items: center;
          border-radius: 4px;
          flex-shrink: 0;
          transition: color 0.15s, background 0.15s;
        }

        .sidebar-logout-btn:hover {
          color: var(--color-danger);
          background: var(--color-danger-bg);
        }

        @media (max-width: 1024px) {
          .sidebar {
            width: 64px;
          }
          .sidebar-brand-name,
          .sidebar-link span,
          .sidebar-user-info {
            display: none;
          }
          .sidebar-collapse-btn {
            display: none;
          }
        }
      `}</style>
    </aside>
  );
}
