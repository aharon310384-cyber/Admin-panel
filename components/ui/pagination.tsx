import Link from "next/link";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  ariaLabel?: string;
  siblingCount?: number;
  boundaryCount?: number;
};

type PaginationItem = number | "ellipsis-start" | "ellipsis-end";

function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(page)), totalPages);
}

function range(start: number, end: number): number[] {
  const pages: number[] = [];

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
}

function paginationItems(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
  boundaryCount: number
): PaginationItem[] {
  const visible = new Set<number>();
  const current = clampPage(currentPage, totalPages);

  for (const page of range(1, Math.min(boundaryCount, totalPages))) {
    visible.add(page);
  }

  for (const page of range(
    Math.max(totalPages - boundaryCount + 1, 1),
    totalPages
  )) {
    visible.add(page);
  }

  for (const page of range(
    Math.max(current - siblingCount, 1),
    Math.min(current + siblingCount, totalPages)
  )) {
    visible.add(page);
  }

  const sorted = [...visible].sort((left, right) => left - right);
  const items: PaginationItem[] = [];

  for (const page of sorted) {
    const previous = items[items.length - 1];

    if (typeof previous === "number") {
      const gap = page - previous;
      if (gap === 2) {
        items.push(previous + 1);
      } else if (gap > 2) {
        items.push(page > current ? "ellipsis-end" : "ellipsis-start");
      }
    }

    items.push(page);
  }

  return items;
}

export function Pagination({
  currentPage,
  totalPages,
  hrefForPage,
  ariaLabel = "Пагинация",
  siblingCount = 2,
  boundaryCount = 1,
}: PaginationProps) {
  const safeTotalPages = Number.isFinite(totalPages)
    ? Math.max(0, Math.floor(totalPages))
    : 0;

  if (safeTotalPages <= 1) {
    return null;
  }

  const current = clampPage(currentPage, safeTotalPages);
  const items = paginationItems(
    current,
    safeTotalPages,
    Math.max(0, siblingCount),
    Math.max(1, boundaryCount)
  );
  const previousPage = current - 1;
  const nextPage = current + 1;

  return (
    <nav className="compact-pagination" aria-label={ariaLabel}>
      <div className="compact-pagination__list">
        {previousPage >= 1 ? (
          <Link
            href={hrefForPage(previousPage)}
            className="compact-pagination__item compact-pagination__arrow"
            aria-label="Предыдущая страница"
          >
            ‹
          </Link>
        ) : (
          <span
            className="compact-pagination__item compact-pagination__arrow compact-pagination__item--disabled"
            aria-label="Предыдущая страница"
            aria-disabled="true"
          >
            ‹
          </span>
        )}

        {items.map((item) =>
          typeof item === "number" ? (
            item === current ? (
              <span
                key={item}
                className="compact-pagination__item compact-pagination__item--active"
                aria-current="page"
              >
                {item}
              </span>
            ) : (
              <Link
                key={item}
                href={hrefForPage(item)}
                className="compact-pagination__item"
                aria-label={`Страница ${item}`}
              >
                {item}
              </Link>
            )
          ) : (
            <span
              key={item}
              className="compact-pagination__ellipsis"
              aria-hidden="true"
            >
              …
            </span>
          )
        )}

        {nextPage <= safeTotalPages ? (
          <Link
            href={hrefForPage(nextPage)}
            className="compact-pagination__item compact-pagination__arrow"
            aria-label="Следующая страница"
          >
            ›
          </Link>
        ) : (
          <span
            className="compact-pagination__item compact-pagination__arrow compact-pagination__item--disabled"
            aria-label="Следующая страница"
            aria-disabled="true"
          >
            ›
          </span>
        )}
      </div>

      <style>{`
        .compact-pagination {
          display: flex;
          justify-content: center;
          padding: 12px 16px;
          border-top: 1px solid var(--color-border);
          overflow-x: auto;
        }

        .compact-pagination__list {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-width: max-content;
        }

        .compact-pagination__item,
        .compact-pagination__ellipsis {
          flex: 0 0 auto;
        }

        .compact-pagination__item {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          font-size: 13px;
          line-height: 1;
          text-decoration: none;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }

        .compact-pagination__item:hover {
          background: var(--color-muted-bg);
          color: var(--color-text);
        }

        .compact-pagination__item:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .compact-pagination__item--active {
          background: var(--color-accent);
          color: var(--color-accent-fg);
          font-weight: 600;
        }

        .compact-pagination__item--active:hover {
          background: var(--color-accent-hover);
          color: var(--color-accent-fg);
        }

        .compact-pagination__item--disabled {
          color: var(--color-muted);
          opacity: 0.45;
          pointer-events: none;
        }

        .compact-pagination__ellipsis {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 34px;
          color: var(--color-muted);
          font-size: 13px;
        }

        .compact-pagination__arrow {
          font-size: 18px;
          font-weight: 600;
        }

        @media (max-width: 640px) {
          .compact-pagination {
            justify-content: flex-start;
            padding: 10px 12px;
          }

          .compact-pagination__item {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </nav>
  );
}
