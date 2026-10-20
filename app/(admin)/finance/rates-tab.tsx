import FinanceForm from "./finance-form";
import { formatCny, formatDateTime, formatNumber, formatUsd } from "@/lib/utils";
import type { FinanceSettingsView, RateChangeRow, RatesStats } from "@/lib/finance";

type Props = {
  settings: FinanceSettingsView;
  stats: RatesStats;
  history: RateChangeRow[];
  isAdmin: boolean;
};

const CURRENCY_LABEL: Record<RateChangeRow["currency"], string> = { USD: "¥ за $", EUR: "¥ за €" };
const rateText = (rate: number | null) => (rate != null ? rate.toFixed(4) : "не задан");

export default function RatesTab({ settings, stats, history, isAdmin }: Props) {
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
              {settings.exchangeRateCnyPerUsd != null
                ? <>1 USD = {settings.exchangeRateCnyPerUsd.toFixed(4)} CNY</>
                : "не задан"}
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

      {/* Регистр курсов: кто, когда и с какого значения поменял курс */}
      <section className="stats">
        <h2 className="stats-title">История изменений курса</h2>
        {history.length ? (
          <div className="history-wrap">
            <table className="history">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Курс</th>
                  <th className="num">Было</th>
                  <th className="num">Стало</th>
                  <th>Кто</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="nowrap">{formatDateTime(row.changedAt)}</td>
                    <td className="nowrap">{CURRENCY_LABEL[row.currency]}</td>
                    <td className="num mono">{row.note ? "—" : rateText(row.oldRate)}</td>
                    <td className="num mono strong">{rateText(row.newRate)}</td>
                    <td>
                      {row.author ?? "—"}
                      {row.note && <span className="history-note"> · {row.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="stats-hint">Курс ещё не меняли — запись появится при первом сохранении.</p>
        )}
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
        .history-wrap { overflow-x: auto; }
        .history { width: 100%; border-collapse: collapse; font-size: 13px; }
        .history th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .history td { padding: 9px 12px; border-bottom: 1px solid var(--color-border); color: var(--color-text); }
        .history tbody tr:last-child td { border-bottom: none; }
        .history .num { text-align: right; font-variant-numeric: tabular-nums; }
        .history .nowrap { white-space: nowrap; }
        .history .strong { font-weight: 600; }
        .history-note { color: var(--color-muted); }
      `}</style>
    </div>
  );
}
