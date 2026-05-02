"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/types";
import type { OrderStatus } from "@prisma/client";

const STATUSES: OrderStatus[] = [
  "NEW",
  "PROCESSING",
  "PAID",
  "SHIPPED",
  "COMPLETED",
  "RETURNED_PAID",
  "RETURNED_UNPAID",
  "CANCELED",
];

export default function OrdersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const amountMin = searchParams.get("amountMin") ?? "";
  const amountMax = searchParams.get("amountMax") ?? "";

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const clearAll = () => {
    router.push(pathname);
  };

  const hasFilters = search || status || dateFrom || dateTo || amountMin || amountMax;

  return (
    <div className="filters-wrap">
      <div className="filters-row">
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="search"
            placeholder="Поиск по номеру заказа, получателю или посылке..."
            defaultValue={search}
            className="search-input"
            onChange={(e) => setParam("search", e.target.value)}
          />
        </div>

        <button
          type="button"
          className={`btn-filter ${showFilters ? "btn-filter--active" : ""}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          Фильтры
          {hasFilters && !showFilters && <span className="filter-badge" />}
          <ChevronDown
            size={14}
            style={{
              transform: showFilters ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          />
        </button>

        {hasFilters && (
          <button type="button" className="btn-clear" onClick={clearAll}>
            <X size={14} />
            Сбросить
          </button>
        )}
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-group">
            <label className="filter-label">Статус</label>
            <div className="filter-chips">
              <button
                type="button"
                className={`status-filter-chip status-filter-chip--all ${!status ? "status-filter-chip--selected" : ""}`}
                onClick={() => setParam("status", "")}
              >
                Все
              </button>
              {STATUSES.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`status-filter-chip status-filter-chip--${ORDER_STATUS_TONE[s]} ${status === s ? "status-filter-chip--selected" : ""}`}
                  onClick={() => setParam("status", s)}
                >
                  {ORDER_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Дата заказа</label>
            <div className="date-range">
              <input
                type="date"
                className="filter-input"
                value={dateFrom}
                onChange={(e) => setParam("dateFrom", e.target.value)}
                aria-label="Дата от"
              />
              <span className="range-sep">—</span>
              <input
                type="date"
                className="filter-input"
                value={dateTo}
                onChange={(e) => setParam("dateTo", e.target.value)}
                aria-label="Дата до"
              />
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Расчет, $</label>
            <div className="date-range">
              <input
                type="number"
                className="filter-input filter-input--narrow"
                value={amountMin}
                onChange={(e) => setParam("amountMin", e.target.value)}
                placeholder="От"
                min="0"
              />
              <span className="range-sep">—</span>
              <input
                type="number"
                className="filter-input filter-input--narrow"
                value={amountMax}
                onChange={(e) => setParam("amountMax", e.target.value)}
                placeholder="До"
                min="0"
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .filters-wrap { display: flex; flex-direction: column; gap: 12px; }

        .filters-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .search-wrap {
          position: relative;
          flex: 1;
          min-width: 200px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-muted);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 9px 12px 9px 36px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 13.5px;
          color: var(--color-text);
          font-family: var(--font-sans);
          outline: none;
          transition: border-color 0.15s;
        }

        .search-input:focus { border-color: var(--color-accent); }

        .btn-filter {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 14px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
          cursor: pointer;
          white-space: nowrap;
          font-family: var(--font-sans);
          transition: background 0.15s;
          position: relative;
        }

        .btn-filter:hover, .btn-filter--active {
          background: var(--color-muted-bg);
          border-color: var(--color-border-strong);
        }

        .filter-badge {
          width: 6px;
          height: 6px;
          background: var(--color-accent);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .btn-clear {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 9px 14px;
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 13px;
          color: var(--color-muted);
          cursor: pointer;
          white-space: nowrap;
          font-family: var(--font-sans);
          transition: color 0.15s, border-color 0.15s;
        }

        .btn-clear:hover { color: var(--color-danger); border-color: var(--color-danger); }

        .filter-panel {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 16px;
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .filter-group { display: flex; flex-direction: column; gap: 8px; }
        .filter-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); }

        .filter-chips { display: flex; flex-wrap: wrap; gap: 6px; }

        .status-filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid currentColor;
          border-radius: var(--radius-full);
          font-size: 12px;
          font-weight: 700;
          background: transparent;
          cursor: pointer;
          font-family: var(--font-sans);
          transition: background 0.15s, box-shadow 0.15s, transform 0.15s;
        }

        .status-filter-chip::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
        }

        .status-filter-chip:hover { transform: translateY(-1px); }
        .status-filter-chip--selected { box-shadow: inset 0 0 0 1px currentColor; }
        .status-filter-chip--all { color: var(--color-text-secondary); border-color: var(--color-border); background: var(--color-muted-bg); }
        .status-filter-chip--new { color: var(--color-status-new); background: var(--color-status-new-bg); }
        .status-filter-chip--processing { color: var(--color-status-processing); background: var(--color-status-processing-bg); }
        .status-filter-chip--shipped { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
        .status-filter-chip--completed,
        .status-filter-chip--paid { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .status-filter-chip--canceled { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }
        .status-filter-chip--returned-paid { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .status-filter-chip--returned-unpaid { color: var(--color-status-processing); background: var(--color-status-processing-bg); }

        .date-range {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .range-sep {
          color: var(--color-muted);
          font-size: 13px;
        }

        .filter-input {
          padding: 7px 10px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 13px;
          color: var(--color-text);
          font-family: var(--font-sans);
          outline: none;
          transition: border-color 0.15s;
          width: 140px;
        }

        .filter-input--narrow { width: 100px; }

        .filter-input:focus { border-color: var(--color-accent); }
      `}</style>
    </div>
  );
}
