import type { Metadata } from "next";
import Link from "next/link";
import { BadgeDollarSign, ChevronRight, User, Users } from "lucide-react";
import { getClientCabinetContext } from "@/lib/client-cabinet";

export const metadata: Metadata = { title: "Ещё" };

const ITEMS = [
  { href: "/cabinet/recipients", label: "Получатели", desc: "Адреса доставки", icon: Users },
  { href: "/cabinet/tariffs", label: "Тарифы", desc: "Стоимость доставки", icon: BadgeDollarSign },
  { href: "/cabinet/profile", label: "Профиль", desc: "Контакты и настройки", icon: User },
];

export default async function ClientCabinetMorePage() {
  await getClientCabinetContext();

  return (
    <div className="mr">
      <h1 className="mr-title">Ещё</h1>

      <nav className="mr-list" aria-label="Дополнительные разделы">
        {ITEMS.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="mr-item">
            <span className="mr-icon"><Icon size={18} /></span>
            <span className="mr-body">
              <span className="mr-label">{label}</span>
              <span className="mr-desc">{desc}</span>
            </span>
            <ChevronRight size={17} className="mr-arrow" />
          </Link>
        ))}
      </nav>

      <style>{`
        .mr { display: flex; flex-direction: column; gap: 14px; padding-bottom: 8px; }
        .mr-title { margin: 8px 0 0 4px; font-family: var(--font-space-grotesk), sans-serif; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
        .mr-list { display: flex; flex-direction: column; gap: 10px; }
        .mr-item {
          display: flex; align-items: center; gap: 13px; padding: 15px 16px;
          border-radius: var(--cab-radius-md); background: var(--cab-surface);
          border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm);
          text-decoration: none; color: var(--cab-text);
          transition: transform 0.14s ease, box-shadow 0.14s ease;
        }
        .mr-item:hover { transform: translateY(-1px); box-shadow: var(--cab-shadow-md); }
        .mr-icon {
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 38px; height: 38px; border-radius: 12px; color: var(--cab-green-deep);
          background: color-mix(in srgb, var(--cab-green) 12%, transparent);
        }
        .mr-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .mr-label { font-size: 14.5px; font-weight: 600; }
        .mr-desc { font-size: 12px; color: var(--cab-muted); }
        .mr-arrow { color: var(--cab-muted); flex-shrink: 0; }
      `}</style>
    </div>
  );
}
