"use client";

// Каркас админки: верхнее меню, панели по настройке сотрудника («Настройка панелей», как в 1С) и рабочая область.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import TopNav from "@/components/layout/topnav";
import { cn } from "@/lib/utils";
import { FavoritesPanel, FunctionsPanel, HistoryPanel, OpenPanel, SectionsPanel, type Orientation } from "@/components/layout/panels";
import { recordVisit, toggleFavorite } from "@/actions/interface";
import {
  HISTORY_LIMIT,
  SECTIONS,
  placedPanels,
  sectionForPath,
  type HistoryEntry,
  type PageRef,
  type PanelCode,
  type PanelLayout,
  type PanelZone,
} from "@/lib/interface";

const OPEN_TABS_KEY = "pf-open-tabs";
const OPEN_TABS_LIMIT = 12;

// Название страницы: заголовок вкладки браузера; для карточек — ещё и заголовок на странице (номер, имя).
function pageTitle(pathname: string) {
  const base = document.title.replace(/\s*\|\s*Админ-панель\s*$/, "").trim();
  const h1 = document.querySelector(".admin-content h1")?.textContent?.trim() ?? "";
  const isCard = pathname.split("/").filter(Boolean).length >= 2;
  if (isCard && h1 && h1 !== base && !base.includes(h1) && h1.length <= 60) return `${base}: ${h1}`.slice(0, 120);
  return (base || h1 || pathname).slice(0, 120);
}

function readTabs(): PageRef[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(OPEN_TABS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((t) => t && typeof t.path === "string" && typeof t.href === "string") : [];
  } catch {
    return [];
  }
}

function writeTabs(tabs: PageRef[]) {
  try {
    sessionStorage.setItem(OPEN_TABS_KEY, JSON.stringify(tabs));
  } catch {
    // без sessionStorage вкладки живут до перезагрузки страницы
  }
}

type AdminShellProps = {
  userName: string;
  userRole: string;
  panels: PanelLayout;
  favorites: PageRef[];
  history: HistoryEntry[];
  children: React.ReactNode;
};

export default function AdminShell({ userName, userRole, panels, favorites: savedFavorites, history: savedHistory, children }: AdminShellProps) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();

  const [favorites, setFavorites] = useState(savedFavorites);
  const [history, setHistory] = useState(savedHistory);
  const [tabs, setTabs] = useState<PageRef[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const lastRecorded = useRef<string | null>(null);

  useEffect(() => setFavorites(savedFavorites), [savedFavorites]);
  useEffect(() => setHistory(savedHistory), [savedHistory]);
  useEffect(() => setTabs(readTabs()), []);
  // Раздел по умолчанию — тот, где открытая страница.
  useEffect(() => setSelectedSection(null), [pathname]);

  const updateTabs = useCallback((update: (tabs: PageRef[]) => PageRef[]) => {
    setTabs((prev) => {
      const next = update(prev);
      writeTabs(next);
      return next;
    });
  }, []);

  // Открытая страница → вкладка в «Открытых» и строка в «Истории».
  useEffect(() => {
    const href = search ? `${pathname}?${search}` : pathname;
    let cancelled = false;
    const capture = (): PageRef => {
      const page = { path: pathname, href, title: pageTitle(pathname) };
      updateTabs((prev) => {
        const index = prev.findIndex((tab) => tab.path === pathname);
        if (index >= 0) return prev.map((tab, i) => (i === index ? page : tab));
        let next = [...prev, page];
        while (next.length > OPEN_TABS_LIMIT) {
          const drop = next.findIndex((tab) => tab.path !== pathname);
          next = next.filter((_, i) => i !== drop);
        }
        return next;
      });
      setHistory((prev) =>
        [{ ...page, at: new Date().toISOString() }, ...prev.filter((item) => item.path !== pathname)].slice(0, HISTORY_LIMIT)
      );
      return page;
    };
    // Заголовок новой страницы появляется не сразу — берём его дважды.
    const first = setTimeout(() => !cancelled && capture(), 250);
    const second = setTimeout(() => {
      if (cancelled) return;
      const page = capture();
      if (lastRecorded.current !== pathname) {
        lastRecorded.current = pathname;
        recordVisit(page).catch(() => {});
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [pathname, search, updateTabs]);

  const closeTab = (path: string) => {
    const index = tabs.findIndex((tab) => tab.path === path);
    const next = tabs.filter((tab) => tab.path !== path);
    updateTabs(() => next);
    if (path === pathname) router.push((next[Math.max(0, index - 1)] ?? next[0])?.href ?? "/dashboard");
  };

  const isFavorite = favorites.some((page) => page.path === pathname);
  const changeFavorite = async (page: PageRef) => {
    const exists = favorites.some((item) => item.path === page.path);
    setFavorites(exists ? favorites.filter((item) => item.path !== page.path) : [...favorites, page]);
    const result = await toggleFavorite(page);
    if (result && "favorites" in result && result.favorites) setFavorites(result.favorites);
  };
  const toggleCurrentFavorite = () => {
    const href = search ? `${pathname}?${search}` : pathname;
    changeFavorite({ path: pathname, href, title: pageTitle(pathname) });
  };

  const placed = placedPanels(panels);
  const currentSection =
    SECTIONS.find((section) => section.code === selectedSection) ?? sectionForPath(pathname) ?? SECTIONS[0];

  const renderPanel = (code: PanelCode, zone: PanelZone) => {
    const orientation: Orientation = zone === "left" || zone === "right" ? "vertical" : "horizontal";
    switch (code) {
      case "sections":
        return (
          <SectionsPanel
            key={code}
            zone={zone}
            pathname={pathname}
            current={selectedSection || sectionForPath(pathname) ? currentSection : undefined}
            functionsPlaced={placed.has("functions")}
            onSelect={setSelectedSection}
          />
        );
      case "functions":
        return <FunctionsPanel key={code} orientation={orientation} pathname={pathname} section={currentSection} />;
      case "open":
        return <OpenPanel key={code} orientation={orientation} pathname={pathname} tabs={tabs} onClose={closeTab} />;
      case "favorites":
        return (
          <FavoritesPanel key={code} orientation={orientation} pathname={pathname} favorites={favorites} onRemove={changeFavorite} />
        );
      case "history":
        return <HistoryPanel key={code} orientation={orientation} pathname={pathname} history={history} />;
    }
  };

  return (
    <div className={cn("admin-layout", panels.bottom.length > 0 && "admin-layout--bottom")}>
      <TopNav userName={userName} userRole={userRole} isFavorite={isFavorite} onToggleFavorite={toggleCurrentFavorite} />

      {panels.top.length > 0 && (
        <div className="shell-zone shell-zone--top">
          {panels.top.map((code) => (
            <div key={code} className="shell-zone-inner">
              {renderPanel(code, "top")}
            </div>
          ))}
        </div>
      )}

      <div className="shell-body">
        {panels.left.length > 0 && (
          <aside className="shell-zone shell-zone--side shell-zone--left">
            <div className="shell-side-inner">{panels.left.map((code) => renderPanel(code, "left"))}</div>
          </aside>
        )}
        <main className="admin-main">
          <div className="admin-content">{children}</div>
        </main>
        {panels.right.length > 0 && (
          <aside className="shell-zone shell-zone--side shell-zone--right">
            <div className="shell-side-inner">{panels.right.map((code) => renderPanel(code, "right"))}</div>
          </aside>
        )}
      </div>

      {panels.bottom.length > 0 && (
        <div className="shell-zone shell-zone--bottom">
          {panels.bottom.map((code) => (
            <div key={code} className="shell-zone-inner">
              {renderPanel(code, "bottom")}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .admin-layout { display: flex; flex-direction: column; min-height: 100dvh; }
        .shell-body { flex: 1; display: flex; min-width: 0; }
        .admin-main { flex: 1; min-width: 0; overflow-x: hidden; }
        .admin-content { padding: 28px 32px; max-width: 1600px; margin: 0 auto; width: 100%; }

        .shell-zone { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); }
        .shell-zone--top { border-bottom: 1px solid var(--color-border); position: relative; z-index: 25; }
        .shell-zone--bottom { border-top: 1px solid var(--color-border); position: sticky; bottom: 0; z-index: 25; }
        .shell-zone-inner { max-width: 1600px; margin: 0 auto; padding: 0 20px; }
        .shell-zone-inner + .shell-zone-inner { border-top: 1px solid var(--color-border); }
        .shell-zone--side { width: 232px; flex-shrink: 0; }
        .shell-side-inner {
          position: sticky; top: 56px; max-height: calc(100dvh - 56px - var(--shell-bottom, 0px)); overflow-y: auto;
          padding: 12px 10px; display: flex; flex-direction: column; gap: 14px;
        }
        .admin-layout--bottom { --shell-bottom: 48px; }
        .shell-zone--left { border-right: 1px solid var(--color-border); }
        .shell-zone--right { border-left: 1px solid var(--color-border); }

        .pnl { display: flex; gap: 4px; min-width: 0; }
        .pnl--h { flex-direction: row; align-items: center; padding: 6px 0; overflow-x: auto; scrollbar-width: thin; }
        .pnl--v { flex-direction: column; align-items: stretch; }
        .pnl-title {
          display: inline-flex; align-items: center; gap: 5px; margin: 0; padding: 4px 8px; flex-shrink: 0;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted);
        }
        .pnl--h .pnl-title { padding-right: 10px; margin-right: 4px; border-right: 1px solid var(--color-border); }
        .pnl-empty { margin: 0; padding: 6px 8px; font-size: 12.5px; color: var(--color-muted); white-space: nowrap; }
        .pnl--v .pnl-empty { white-space: normal; }

        .pnl-item {
          display: inline-flex; align-items: center; gap: 8px; padding: 7px 10px; min-width: 0;
          border: none; background: none; border-radius: var(--radius-sm); cursor: pointer;
          font: inherit; font-size: 13.5px; font-weight: 500; color: var(--color-text-secondary);
          text-decoration: none; white-space: nowrap; transition: color 0.15s, background 0.15s;
        }
        .pnl-item span { overflow: hidden; text-overflow: ellipsis; }
        .pnl-item svg { flex-shrink: 0; }
        .pnl-item:hover { color: var(--color-text); background: var(--color-muted-bg); }
        .pnl-item--active { color: var(--color-accent); background: oklch(52% 0.14 42 / 0.08); }
        .pnl--v .pnl-item { display: flex; width: 100%; }

        .pnl-section { padding: 8px 12px; }
        .pnl-section-wrap { flex-shrink: 0; }
        .pnl--v .pnl-section-wrap { width: 100%; }
        .pnl-popup {
          position: fixed; z-index: 50; min-width: 240px; max-height: 70dvh; overflow-y: auto;
          display: flex; flex-direction: column; gap: 2px; padding: 8px;
          background: #fffcf6; border: 1px solid var(--color-border); border-radius: var(--radius-md);
          box-shadow: var(--shadow-dropdown);
        }
        .pnl-popup .pnl-item { display: flex; }
        .pnl-popup-title {
          margin: 0; padding: 2px 10px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border);
        }

        .pnl-tab {
          display: inline-flex; align-items: center; flex-shrink: 0; max-width: 240px;
          border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface);
        }
        .pnl--v .pnl-tab { max-width: none; width: 100%; }
        .pnl-tab--plain { border-color: transparent; background: none; }
        .pnl-tab--active { border-color: oklch(52% 0.14 42 / 0.45); background: oklch(52% 0.14 42 / 0.08); }
        .pnl-tab-link {
          flex: 1; min-width: 0; padding: 6px 4px 6px 10px; font-size: 13px; font-weight: 500;
          color: var(--color-text-secondary); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .pnl-tab--active .pnl-tab-link { color: var(--color-accent); }
        .pnl-tab-link:hover { color: var(--color-text); }
        .pnl-tab--plain .pnl-item { flex: 1; }
        .pnl-tab-close {
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 24px; height: 24px; margin-right: 3px; border: none; background: none; cursor: pointer;
          border-radius: 6px; color: var(--color-muted);
        }
        .pnl-tab-close:hover { color: var(--color-danger); background: var(--color-danger-bg); }

        .pnl-history { justify-content: space-between; }
        .pnl-history-title { overflow: hidden; text-overflow: ellipsis; }
        .pnl-history-time { flex-shrink: 0; font-size: 11.5px; font-weight: 400; color: var(--color-muted); }

        @media (max-width: 900px) {
          .shell-body { flex-direction: column; }
          .shell-zone--side { width: auto; border: none; border-bottom: 1px solid var(--color-border); }
          .shell-side-inner { position: static; max-height: none; padding: 6px 16px; }
          .shell-zone--side .pnl--v { flex-direction: row; flex-wrap: wrap; }
          .shell-zone--side .pnl-item, .shell-zone--side .pnl-section-wrap, .shell-zone--side .pnl-tab { width: auto; }
        }
        @media (max-width: 768px) {
          .admin-content { padding: 20px 16px; }
          .shell-zone-inner { padding: 0 16px; }
        }
      `}</style>
    </div>
  );
}
