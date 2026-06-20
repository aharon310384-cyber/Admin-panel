import Link from "next/link";
import { Check, Clock, TrendingUp, Wallet } from "lucide-react";
import { ParcelStatusBadge } from "@/components/ui/status-badge";
import TableRowLink from "@/components/ui/table-row-link";
import { Pagination } from "@/components/ui/pagination";
import { formatCny, formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import type { PaymentsFilter, PaymentsRegistry } from "@/lib/finance";

type Props = {
  data: PaymentsRegistry;
  filter: PaymentsFilter;
};

const FILTER_LINKS: Array<{ key: PaymentsFilter; label: string }> = [
  { key: "all", label: "Все" },
  { key: "paid", label: "Оплачены" },
  { key: "unpaid", label: "Не оплачены" },
];

function buildHref(filter: PaymentsFilter, page?: number): string {
  const query = new URLSearchParams();
  query.set("tab", "payments");
  if (filter !== "all") query.set("paid", filter);
  if (page && page > 1) query.set("page", String(page));
  return `/finance?${query.toString()}`;
}

export default function PaymentsTab({ data, filter }: Props) {
  const totalPages = Math.ceil(data.total / data.pageSize);
  const { summary } = data;

  return (
    <div className="registry">
      <section className="summary">
        <div className="summary-card summary-card--paid">
          <div className="summary-head">
            <Check size={14} aria-hidden="true" />
            <span>Оплачено</span>
          </div>
          <div className="summary-count">{formatNumber(summary.countPaid)}</div>
          <div className="summary-amount tabular">{formatCny(summary.sumPaidCny)}</div>
          <div className="summary-meta tabular">{formatUsd(summary.sumPaidUsd)}</div>
        </div>
        <div className="summary-card summary-card--unpaid">
          <div className="summary-head">
            <Clock size={14} aria-hidden="true" />
            <span>Не оплачено</span>
          </div>
          <div className="summary-count">{formatNumber(summary.countUnpaid)}</div>
          <div className="summary-amount tabular">{formatCny(summary.sumUnpaidCny)}</div>
          <div className="summary-meta tabular">{formatUsd(summary.sumUnpaidUsd)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-head">
            <span>Всего посылок</span>
          </div>
          <div className="summary-count">
            {formatNumber(summary.countPaid + summary.countUnpaid)}
          </div>
          <div className="summary-amount tabular">
            {formatCny(summary.sumPaidCny + summary.sumUnpaidCny)}
          </div>
          <div className="summary-meta tabular">
            {formatUsd(summary.sumPaidUsd + summary.sumUnpaidUsd)}
          </div>
        </div>
      </section>

      <div className="filter-bar">
        <div className="filters">
          {FILTER_LINKS.map(({ key, label }) => (
            <Link
              key={key}
              href={buildHref(key)}
              className={`filter ${filter === key ? "filter--active" : ""}`}
              aria-current={filter === key ? "true" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
        <span className="counter">{formatNumber(data.total)} в списке</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Номер</th>
                <th>Клиент</th>
                <th>Статус</th>
                <th className="num">Расчёт $</th>
                <th className="num">Курс</th>
                <th className="num">К оплате ¥</th>
                <th>Оплата</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <TableRowLink key={row.id} href={`/parcels/${row.id}`}>
                  <td className="text-muted">{formatDateTime(row.createdAt)}</td>
                  <td className="mono link">{row.number}</td>
                  <td>{row.customerName}</td>
                  <td>
                    <ParcelStatusBadge status={row.status} />
                  </td>
                  <td className="num tabular">{formatUsd(row.totalUsd)}</td>
                  <td className="num tabular text-muted">
                    {row.exchangeRateCnyPerUsd.toFixed(4)}
                  </td>
                  <td className="num tabular">{formatCny(row.totalCny)}</td>
                  <td>
                    {row.isPaid ? (
                      <span className="pay-badge pay-badge--paid">
                        <Check size={11} aria-hidden="true" />
                        Оплачен
                      </span>
                    ) : (
                      <span className="pay-badge pay-badge--unpaid">
                        <Clock size={11} aria-hidden="true" />
                        Не оплачен
                      </span>
                    )}
                  </td>
                </TableRowLink>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty">
                    Посылок не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={data.page}
          totalPages={totalPages}
          hrefForPage={(page) => buildHref(filter, page)}
        />
      </div>

      <style>{`
        .registry { display: flex; flex-direction: column; gap: 16px; }

        .summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .summary-card {
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: var(--shadow-card);
        }
        .summary-card--paid { border-color: color-mix(in srgb, var(--color-status-completed) 35%, var(--color-border)); }
        .summary-card--unpaid { border-color: color-mix(in srgb, var(--color-status-new) 35%, var(--color-border)); }
        .summary-card--cost { border-color: color-mix(in srgb, var(--color-status-processing) 28%, var(--color-border)); }
        .summary-card--profit { border-color: color-mix(in srgb, var(--color-accent) 32%, var(--color-border)); }
        .summary-amount--big { font-size: 20px; }
        .summary-head {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: var(--color-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .summary-count { font-size: 22px; font-weight: 700; color: var(--color-text); font-variant-numeric: tabular-nums; }
        .summary-amount { font-size: 14px; font-weight: 600; color: var(--color-text); }
        .summary-meta { font-size: 12px; color: var(--color-muted); }
        .tabular { font-variant-numeric: tabular-nums; }

        .filter-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .filters {
          display: inline-flex;
          gap: 4px;
          padding: 4px;
          background: var(--color-muted-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
        }
        .filter {
          padding: 6px 12px;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--color-text-secondary);
          border-radius: calc(var(--radius-sm) - 2px);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        .filter:hover { color: var(--color-text); }
        .filter--active { background: var(--color-surface); color: var(--color-text); }
        .counter { font-size: 12.5px; color: var(--color-muted); }

        .card {
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-card);
          overflow: hidden;
        }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .table th, .table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--color-border); }
        .table thead th { font-size: 11.5px; font-weight: 600; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.04em; background: var(--color-muted-bg); }
        .table tbody tr:last-child td { border-bottom: none; }
        .table .num { text-align: right; }
        .table thead th.num { text-align: right; }
        .table .mono { font-family: var(--font-mono); font-size: 12.5px; }
        .table .link { color: var(--color-accent); font-weight: 500; }
        .table .text-muted { color: var(--color-muted); }
        .table .negative { color: var(--color-danger); }
        .row-clickable { cursor: pointer; transition: background 0.1s; }
        .row-clickable:hover { background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 32px 16px; color: var(--color-muted); }

        .pay-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          font-size: 11.5px;
          font-weight: 500;
          border-radius: var(--radius-full, 999px);
          border: 1px solid transparent;
        }
        .pay-badge--paid {
          color: var(--color-status-completed);
          background: color-mix(in srgb, var(--color-status-completed) 12%, transparent);
          border-color: color-mix(in srgb, var(--color-status-completed) 22%, transparent);
        }
        .pay-badge--unpaid {
          color: var(--color-muted);
          background: var(--color-muted-bg);
          border-color: var(--color-border);
        }
      `}</style>
    </div>
  );
}
