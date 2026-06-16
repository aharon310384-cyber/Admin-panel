"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutGrid, Package, Plus, User } from "lucide-react";

type Tab = { href: string; label: string; icon: typeof LayoutGrid };

const TABS_LEFT: Tab[] = [
  { href: "/cabinet", label: "Обзор", icon: LayoutGrid },
  { href: "/cabinet/orders", label: "Заказы", icon: ClipboardList },
];

const TABS_RIGHT: Tab[] = [
  { href: "/cabinet/parcels", label: "Посылки", icon: Package },
  { href: "/cabinet/profile", label: "Профиль", icon: User },
];

export default function CabinetNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/cabinet" ? pathname === "/cabinet" : pathname.startsWith(href);

  const renderTab = ({ href, label, icon: Icon }: Tab) => (
    <Link
      key={href}
      href={href}
      className={`cab-tab ${isActive(href) ? "cab-tab--active" : ""}`}
    >
      <Icon size={20} strokeWidth={2} />
      <span>{label}</span>
    </Link>
  );

  return (
    <nav className="cab-nav" aria-label="Навигация кабинета">
      <div className="cab-nav-inner">
        {TABS_LEFT.map(renderTab)}

        <span className="cab-fab cab-fab--off" aria-disabled="true" aria-label="Оформить заказ (скоро)" title="Скоро">
          <Plus size={24} strokeWidth={2.5} />
        </span>

        {TABS_RIGHT.map(renderTab)}
      </div>

      <style>{`
        .cab-nav {
          position: sticky;
          bottom: 0;
          z-index: 50;
          padding: 0 0 max(10px, env(safe-area-inset-bottom));
          background: linear-gradient(to top, var(--cab-bg) 64%, transparent);
          pointer-events: none;
        }
        .cab-nav-inner {
          pointer-events: auto;
          position: relative;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          align-items: center;
          gap: 2px;
          padding: 8px 8px;
          background: var(--cab-surface-glass);
          backdrop-filter: blur(20px) saturate(1.6);
          border: 1px solid var(--cab-border);
          border-radius: 22px;
          box-shadow: var(--cab-shadow-lg);
        }
        .cab-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 7px 4px;
          border-radius: 14px;
          color: var(--cab-muted);
          text-decoration: none;
          font-size: 10.5px;
          font-weight: 600;
          transition: color 0.15s, background 0.15s;
        }
        .cab-tab span { line-height: 1; }
        .cab-tab:hover { color: var(--cab-text); }
        .cab-tab--active { color: var(--cab-green-deep); }
        .cab-tab--active svg { filter: drop-shadow(0 2px 6px color-mix(in srgb, var(--cab-green) 45%, transparent)); }

        .cab-fab {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          margin: -22px auto 0;
          border-radius: 20px;
          color: #fff;
          background: linear-gradient(150deg, var(--cab-green) 0%, var(--cab-green-deep) 100%);
          box-shadow: 0 10px 24px color-mix(in srgb, var(--cab-green) 50%, transparent),
                      inset 0 1px 0 rgba(255,255,255,0.25);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .cab-fab:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 30px color-mix(in srgb, var(--cab-green) 55%, transparent),
                      inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .cab-fab:active { transform: translateY(0); }
        .cab-fab--off { opacity: 0.4; pointer-events: none; box-shadow: none; }

        @media (min-width: 1024px) {
          .cab-nav { display: none; }
        }
      `}</style>
    </nav>
  );
}
