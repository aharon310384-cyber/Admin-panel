"use client";

// Панели вокруг рабочей области — как в 1С. Каждая рисуется в строку (сверху/снизу) или столбиком (слева/справа).
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Clock, House, Pin, Star, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  SECTIONS,
  pathMatches,
  sortFavorites,
  type Favorite,
  type HistoryEntry,
  type PageRef,
  type PanelZone,
  type Section,
} from "@/lib/interface";

export type Orientation = "horizontal" | "vertical";

function panelClass(orientation: Orientation, extra?: string) {
  return cn("pnl", orientation === "horizontal" ? "pnl--h" : "pnl--v", extra);
}

// ── Панель разделов
// Где открыть выпадающий список раздела: рядом с кнопкой, в сторону рабочей области.
function popupPosition(zone: PanelZone, rect: DOMRect): CSSProperties {
  switch (zone) {
    case "left":
      return { top: rect.top, left: rect.right + 8 };
    case "right":
      return { top: rect.top, right: window.innerWidth - rect.left + 8 };
    case "bottom":
      return { bottom: window.innerHeight - rect.top + 6, left: rect.left };
    default:
      return { top: rect.bottom + 6, left: rect.left };
  }
}

export function SectionsPanel({
  zone,
  pathname,
  current,
  functionsPlaced,
  onSelect,
}: {
  zone: PanelZone;
  pathname: string;
  current: Section | undefined;
  functionsPlaced: boolean;
  onSelect: (code: string) => void;
}) {
  // Если панели функций нет на экране, страницы раздела открываются выпадающим списком — как в 1С.
  // Список рисуется поверх всего (portal), чтобы его не обрезали панели.
  const [popup, setPopup] = useState<{ code: string; style: CSSProperties } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const orientation: Orientation = zone === "left" || zone === "right" ? "vertical" : "horizontal";

  useEffect(() => setPopup(null), [pathname]);
  useEffect(() => {
    if (!popup) return;
    const close = () => setPopup(null);
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !popupRef.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [popup]);

  const open = popup ? SECTIONS.find((section) => section.code === popup.code) : undefined;

  return (
    <div ref={ref} className={panelClass(orientation, "pnl-sections")} role="navigation" aria-label="Разделы">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const active = current?.code === section.code;
        return (
          <div key={section.code} className="pnl-section-wrap">
            <button
              type="button"
              className={cn("pnl-item pnl-section", active && "pnl-item--active")}
              aria-expanded={functionsPlaced ? undefined : popup?.code === section.code}
              onClick={(e) => {
                onSelect(section.code);
                if (functionsPlaced) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setPopup((now) => (now?.code === section.code ? null : { code: section.code, style: popupPosition(zone, rect) }));
              }}
            >
              <Icon size={16} />
              <span>{section.label}</span>
            </button>
          </div>
        );
      })}
      {popup &&
        open &&
        createPortal(
          <div ref={popupRef} className="pnl-popup" style={popup.style} role="menu">
            <p className="pnl-popup-title">{open.label}</p>
            {open.items.map(({ href, label, icon: ItemIcon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                className={cn("pnl-item", pathMatches(pathname, href) && "pnl-item--active")}
              >
                <ItemIcon size={16} />
                <span>{label}</span>
              </Link>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

// ── Панель функций текущего раздела
export function FunctionsPanel({
  orientation,
  pathname,
  section,
}: {
  orientation: Orientation;
  pathname: string;
  section: Section | undefined;
}) {
  return (
    <div className={panelClass(orientation)} aria-label="Функции раздела">
      {section ? (
        <>
          <p className="pnl-title">{section.label}</p>
          {section.items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cn("pnl-item", pathMatches(pathname, href) && "pnl-item--active")}>
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          ))}
        </>
      ) : (
        <p className="pnl-empty">Выберите раздел</p>
      )}
    </div>
  );
}

// ── Панель открытых: страницы, открытые в этом окне браузера, как вкладки.
// Первая — «Начальная страница», её не закрыть (как в 1С).
export function OpenPanel({
  orientation,
  pathname,
  tabs,
  onClose,
}: {
  orientation: Orientation;
  pathname: string;
  tabs: PageRef[];
  onClose: (path: string) => void;
}) {
  return (
    <div className={panelClass(orientation, "pnl-open")} aria-label="Открытые">
      <div className={cn("pnl-tab pnl-tab--home", pathname === "/dashboard" && "pnl-tab--active")}>
        <Link href="/dashboard" className="pnl-tab-link" title="Начальная страница">
          <House size={14} />
          <span>Начальная страница</span>
        </Link>
      </div>
      {tabs.map((tab) => (
        <div key={tab.path} className={cn("pnl-tab", tab.path === pathname && "pnl-tab--active")}>
          <Link href={tab.href} className="pnl-tab-link" title={tab.title}>
            <span>{tab.title}</span>
          </Link>
          <button type="button" className="pnl-tab-close" onClick={() => onClose(tab.path)} aria-label={`Закрыть «${tab.title}»`}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Панель избранного
export function FavoritesPanel({
  orientation,
  pathname,
  favorites,
  onRemove,
}: {
  orientation: Orientation;
  pathname: string;
  favorites: Favorite[];
  onRemove: (page: Favorite) => void;
}) {
  return (
    <div className={panelClass(orientation)} aria-label="Избранное">
      <p className="pnl-title">
        <Star size={13} /> Избранное
      </p>
      {favorites.length === 0 && <p className="pnl-empty">Нажмите ☆ рядом с названием страницы</p>}
      {sortFavorites(favorites).map((page) => (
        <div key={page.path} className="pnl-tab pnl-tab--plain">
          <Link
            href={page.href}
            className={cn("pnl-item", page.pinned && "pnl-item--pinned", page.path === pathname && "pnl-item--active")}
            title={page.title}
          >
            {page.pinned && <Pin size={13} className="pnl-pin" />}
            <span>{page.title}</span>
          </Link>
          <button type="button" className="pnl-tab-close" onClick={() => onRemove(page)} aria-label={`Убрать «${page.title}» из избранного`}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function visitTime(at: string) {
  const date = new Date(at);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : formatDate(date);
}

// ── Панель истории
export function HistoryPanel({
  orientation,
  pathname,
  history,
}: {
  orientation: Orientation;
  pathname: string;
  history: HistoryEntry[];
}) {
  return (
    <div className={panelClass(orientation)} aria-label="История">
      <p className="pnl-title">
        <Clock size={13} /> История
      </p>
      {history.length === 0 && <p className="pnl-empty">Пока пусто</p>}
      {history.slice(0, orientation === "horizontal" ? 10 : 20).map((page) => (
        <Link
          key={page.path}
          href={page.href}
          className={cn("pnl-item pnl-history", page.path === pathname && "pnl-item--active")}
          title={page.title}
        >
          <span className="pnl-history-title">{page.title}</span>
          <span className="pnl-history-time">{visitTime(page.at)}</span>
        </Link>
      ))}
    </div>
  );
}
