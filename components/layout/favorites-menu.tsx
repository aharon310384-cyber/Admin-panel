"use client";

// Звёздочка в верхнем меню — список избранного, как в 1С: поиск, «закрепить сверху», убрать.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Pin, PinOff, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sortFavorites, type Favorite } from "@/lib/interface";

export default function FavoritesMenu({
  favorites,
  pathname,
  onPin,
  onRemove,
}: {
  favorites: Favorite[];
  pathname: string;
  onPin: (path: string, pinned: boolean) => void;
  onRemove: (favorite: Favorite) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const list = sortFavorites(favorites).filter((item) => !needle || item.title.toLowerCase().includes(needle));

  return (
    <div className="fav-menu" ref={ref}>
      <button
        type="button"
        className={cn("topnav-icon-link", open && "topnav-link--active")}
        onClick={() => setOpen((v) => !v)}
        title="Избранное"
        aria-label="Избранное"
        aria-expanded={open}
      >
        <Star size={18} />
      </button>

      {open && (
        <div className="fav-menu-panel" role="dialog" aria-label="Избранное">
          <div className="fav-menu-head">
            <p className="fav-menu-title">Избранное</p>
            {favorites.length > 0 && (
              <input
                type="search"
                className="fav-menu-search"
                placeholder="Поиск"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            )}
          </div>
          {favorites.length === 0 ? (
            <p className="fav-menu-empty">
              Пока пусто. Нажмите ☆ рядом с названием страницы — она появится здесь.
            </p>
          ) : list.length === 0 ? (
            <p className="fav-menu-empty">Ничего не найдено</p>
          ) : (
            <ul className="fav-menu-list">
              {list.map((item) => (
                <li key={item.path} className={cn("fav-menu-row", item.pinned && "fav-menu-row--pinned")}>
                  <Link href={item.href} className={cn("fav-menu-link", item.path === pathname && "fav-menu-link--current")} title={item.title}>
                    {item.pinned && <Pin size={13} className="fav-menu-pin" />}
                    <span>{item.title}</span>
                  </Link>
                  <button
                    type="button"
                    className="fav-menu-action"
                    onClick={() => onPin(item.path, !item.pinned)}
                    title={item.pinned ? "Открепить" : "Закрепить сверху"}
                    aria-label={item.pinned ? `Открепить «${item.title}»` : `Закрепить «${item.title}» сверху`}
                  >
                    {item.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button
                    type="button"
                    className="fav-menu-action fav-menu-action--remove"
                    onClick={() => onRemove(item)}
                    title="Убрать из избранного"
                    aria-label={`Убрать «${item.title}» из избранного`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style>{`
        .fav-menu { position: relative; }
        .fav-menu-panel {
          position: absolute; top: calc(100% + 10px); right: 0; z-index: 40; width: min(400px, calc(100vw - 24px));
          max-height: min(70dvh, 560px); display: flex; flex-direction: column;
          background: #fffcf6; border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-dropdown);
        }
        .fav-menu-head { display: flex; align-items: center; gap: 12px; padding: 14px 14px 10px; border-bottom: 1px solid var(--color-border); }
        .fav-menu-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--color-text); flex-shrink: 0; }
        .fav-menu-search {
          flex: 1; min-width: 0; padding: 6px 10px; font: inherit; font-size: 13px; color: var(--color-text);
          background: #fff; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm);
        }
        .fav-menu-empty { margin: 0; padding: 16px 14px; font-size: 13px; color: var(--color-muted); }
        .fav-menu-list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; }
        .fav-menu-row { display: flex; align-items: center; gap: 2px; border-radius: var(--radius-sm); }
        .fav-menu-row:hover { background: var(--color-muted-bg); }
        .fav-menu-link {
          flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 7px 8px;
          font-size: 13.5px; color: var(--color-text); text-decoration: none;
        }
        .fav-menu-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fav-menu-row--pinned .fav-menu-link { font-weight: 700; }
        .fav-menu-link--current { color: var(--color-accent); }
        .fav-menu-pin { flex-shrink: 0; color: #23845f; }
        .fav-menu-action {
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 28px; height: 28px;
          border: none; background: none; cursor: pointer; border-radius: 6px; color: var(--color-muted); opacity: 0.55;
        }
        .fav-menu-row:hover .fav-menu-action, .fav-menu-action:focus-visible { opacity: 1; }
        .fav-menu-action:hover { color: var(--color-text); background: #fff; }
        .fav-menu-action--remove:hover { color: var(--color-danger); background: var(--color-danger-bg); }
        @media (hover: none) { .fav-menu-action { opacity: 1; } }
      `}</style>
    </div>
  );
}
