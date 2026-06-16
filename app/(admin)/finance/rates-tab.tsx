import FinanceForm from "./finance-form";
import { formatCny, formatNumber, formatUsd } from "@/lib/utils";
import type { FinanceSettingsView, RatesStats } from "@/lib/finance";

type Props = {
  settings: FinanceSettingsView;
  stats: RatesStats;
  isAdmin: boolean;
};

export default function RatesTab({ settings, stats, isAdmin }: Props) {
  const onCurrentRatePercent = stats.parcelsTotal
    ? Math.round((stats.parcelsOnCurrentRate / stats.parcelsTotal) * 100)
    : 0;

  return (
    <div className="rates">
      <FinanceForm settings={settings} isAdmin={isAdmin} />

      <section className="stats">
        <h2 className="stats-title">Где используется курс</h2>
        <div className="stats-grid">
          <div className="stat">
            <span className="stat-label">Текущий курс</span>
            <span className="stat-value mono">
              1 USD = {settings.exchangeRateCnyPerUsd.toFixed(4)} CNY
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Всего посылок</span>
            <span className="stat-value">{formatNumber(stats.parcelsTotal)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Посчитаны по текущему курсу</span>
            <span className="stat-value">
              {formatNumber(stats.parcelsOnCurrentRate)}
              {stats.parcelsTotal > 0 && (
                <span className="stat-meta"> · {onCurrentRatePercent}%</span>
              )}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Объём расчётов (USD)</span>
            <span className="stat-value">{formatUsd(stats.totalUsdAll)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Объём расчётов (CNY)</span>
            <span className="stat-value">{formatCny(stats.totalCnyAll)}</span>
          </div>
        </div>
        <p className="stats-hint">
          Курс хранится индивидуально в каждой посылке. Изменение здесь повлияет
          только на новые посылки и не пересчитает уже созданные.
        </p>
      </section>

      <style>{`
        .rates { display: flex; flex-direction: column; gap: 16px; }
        .stats {
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-card);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .stats-title { font-size: 14px; font-weight: 700; margin: 0; color: var(--color-text); }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-muted-bg);
        }
        .stat-label { font-size: 11.5px; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .stat-value { font-size: 16px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
        .stat-meta { font-size: 12px; font-weight: 400; color: var(--color-muted); }
        .mono { font-family: var(--font-mono); }
        .stats-hint { font-size: 12px; color: var(--color-muted); margin: 0; line-height: 1.45; }
      `}</style>
    </div>
  );
}
