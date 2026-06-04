import type { Metadata } from "next";
import { ArrowDown, ArrowRight, Plus, Workflow } from "lucide-react";
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_TONE } from "@/types";
import type { ParcelStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Статусы" };

type StatusNode = {
  code: ParcelStatus;
  description: string;
  count: number;
};

// Mock-данные для макета. На шаге 4-5 будет читаться из БД.
const MAIN_FLOW: StatusNode[] = [
  { code: "NEW", description: "Создана, ожидает оплаты от клиента", count: 124 },
  { code: "PROCESSING", description: "Принята на склад, готовится к отправке", count: 38 },
  { code: "PAID", description: "Оплачена клиентом, ждёт отгрузки", count: 12 },
  { code: "SHIPPED", description: "Передана курьеру, в пути", count: 47 },
  { code: "COMPLETED", description: "Доставлена получателю", count: 880 },
];

const SIDE_FLOW: StatusNode[] = [
  { code: "CANCELED", description: "Отменена до отправки", count: 5 },
  { code: "RETURNED_PAID", description: "Возврат с компенсацией клиенту", count: 2 },
  { code: "RETURNED_UNPAID", description: "Возврат без компенсации", count: 1 },
];

const TRANSITIONS: Array<{ from: ParcelStatus; to: ParcelStatus }> = [
  { from: "NEW", to: "PROCESSING" },
  { from: "NEW", to: "CANCELED" },
  { from: "PROCESSING", to: "PAID" },
  { from: "PROCESSING", to: "CANCELED" },
  { from: "PAID", to: "SHIPPED" },
  { from: "SHIPPED", to: "COMPLETED" },
  { from: "SHIPPED", to: "RETURNED_PAID" },
  { from: "SHIPPED", to: "RETURNED_UNPAID" },
  { from: "COMPLETED", to: "RETURNED_PAID" },
];

function StatusCard({ node }: { node: StatusNode }) {
  const tone = PARCEL_STATUS_TONE[node.code];
  return (
    <div className={`status-card status-card--${tone}`}>
      <div className="status-card-head">
        <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />
        <span className="status-card-code">{node.code}</span>
      </div>
      <p className="status-card-title">{PARCEL_STATUS_LABELS[node.code]}</p>
      <p className="status-card-desc">{node.description}</p>
      <div className="status-card-meta">
        <span className="status-card-count">{node.count}</span>
        <span className="status-card-count-label">посылок</span>
      </div>
    </div>
  );
}

export default function StatusesPage() {
  const totalStatuses = MAIN_FLOW.length + SIDE_FLOW.length;
  const totalParcels = [...MAIN_FLOW, ...SIDE_FLOW].reduce((s, n) => s + n.count, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Справочник</p>
          <h1 className="page-title">Статусы посылок</h1>
          <p className="page-subtitle">
            Воронка переходов и счётчики по этапам · {totalStatuses} статуса · {totalParcels} посылок
          </p>
        </div>
        <button type="button" className="btn btn-primary" disabled title="Будет доступно на шаге 6">
          <Plus size={16} aria-hidden="true" />
          Новый статус
        </button>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">Основной поток</p>
            <h2 className="card-title">Жизненный цикл посылки</h2>
          </div>
          <span className="card-hint">
            <Workflow size={14} aria-hidden="true" />
            Слева направо — продвижение, вниз — отклонения
          </span>
        </div>

        <div className="flow">
          <div className="flow-row flow-row--main">
            {MAIN_FLOW.map((node, i) => (
              <div key={node.code} className="flow-cell">
                <StatusCard node={node} />
                {i < MAIN_FLOW.length - 1 ? (
                  <ArrowRight size={20} className="flow-arrow" aria-hidden="true" />
                ) : null}
              </div>
            ))}
          </div>

          <div className="flow-divider" aria-hidden="true">
            <ArrowDown size={18} />
            <span>отклонения и возвраты</span>
          </div>

          <div className="flow-row flow-row--side">
            {SIDE_FLOW.map((node, i) => (
              <div key={node.code} className="flow-cell">
                <StatusCard node={node} />
                {i < SIDE_FLOW.length - 1 ? (
                  <ArrowRight size={20} className="flow-arrow" aria-hidden="true" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">Матрица переходов</p>
            <h2 className="card-title">Из какого в какой статус можно перейти</h2>
          </div>
          <span className="card-hint">Заглушка · редактирование на шаге 6</span>
        </div>

        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="matrix-corner" aria-label="Источник / Назначение" />
                {[...MAIN_FLOW, ...SIDE_FLOW].map((to) => (
                  <th key={to.code} title={PARCEL_STATUS_LABELS[to.code]}>
                    <span className="matrix-col-code">{to.code}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...MAIN_FLOW, ...SIDE_FLOW].map((from) => (
                <tr key={from.code}>
                  <th scope="row">
                    <span className={`status-dot status-dot--${PARCEL_STATUS_TONE[from.code]}`} aria-hidden="true" />
                    <span className="matrix-row-code">{from.code}</span>
                  </th>
                  {[...MAIN_FLOW, ...SIDE_FLOW].map((to) => {
                    const allowed = TRANSITIONS.some(
                      (t) => t.from === from.code && t.to === to.code
                    );
                    const self = from.code === to.code;
                    return (
                      <td key={to.code} className={self ? "matrix-self" : ""}>
                        {self ? (
                          <span className="matrix-mark matrix-mark--self">·</span>
                        ) : allowed ? (
                          <span className="matrix-mark matrix-mark--on">●</span>
                        ) : (
                          <span className="matrix-mark matrix-mark--off">○</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }

        .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-eyebrow { margin: 0 0 4px; color: var(--color-accent); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); letter-spacing: -0.02em; }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 6px 0 0; }

        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; border: 1px solid transparent; transition: opacity 0.15s, transform 0.05s; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { color: var(--color-accent-fg); background: var(--color-accent); }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); padding: 20px; display: flex; flex-direction: column; gap: 18px; }
        .card-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .card-kicker { margin: 0 0 4px; color: var(--color-accent); font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .card-title { margin: 0; color: var(--color-text); font-size: 16px; font-weight: 700; }
        .card-hint { display: inline-flex; align-items: center; gap: 6px; color: var(--color-muted); font-size: 12px; }

        .flow { display: flex; flex-direction: column; gap: 14px; }
        .flow-row { display: flex; align-items: stretch; gap: 0; flex-wrap: wrap; }
        .flow-row--main { justify-content: flex-start; }
        .flow-row--side { justify-content: flex-start; }
        .flow-cell { display: flex; align-items: center; gap: 4px; }
        .flow-arrow { color: var(--color-muted); flex-shrink: 0; margin: 0 6px; }

        .flow-divider { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; padding: 4px 12px 4px 8px; margin-left: 90px; color: var(--color-muted); font-size: 12px; font-weight: 500; }

        .status-card { width: 168px; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-strong, var(--color-surface)); display: flex; flex-direction: column; gap: 6px; position: relative; }
        .status-card::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 0 2px 2px 0; background: currentColor; opacity: 0.7; }
        .status-card--new { color: var(--color-status-new); }
        .status-card--processing { color: var(--color-status-processing); }
        .status-card--shipped { color: var(--color-status-shipped); }
        .status-card--completed, .status-card--paid { color: var(--color-status-completed); }
        .status-card--canceled { color: var(--color-status-canceled); }
        .status-card--returned-paid { color: var(--color-status-completed); }
        .status-card--returned-unpaid { color: var(--color-status-processing); }

        .status-card-head { display: flex; align-items: center; gap: 6px; }
        .status-card-code { font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; color: var(--color-muted); }
        .status-card-title { margin: 0; color: var(--color-text); font-size: 14px; font-weight: 600; }
        .status-card-desc { margin: 0; color: var(--color-muted); font-size: 11.5px; line-height: 1.35; min-height: 30px; }
        .status-card-meta { display: flex; align-items: baseline; gap: 5px; margin-top: 2px; }
        .status-card-count { color: var(--color-text); font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .status-card-count-label { color: var(--color-muted); font-size: 11px; }

        .matrix-wrap { overflow-x: auto; }
        .matrix { border-collapse: collapse; font-size: 12px; min-width: 100%; }
        .matrix th, .matrix td { padding: 8px 10px; text-align: center; border-bottom: 1px solid var(--color-border); border-right: 1px solid var(--color-border); white-space: nowrap; }
        .matrix th:last-child, .matrix td:last-child { border-right: none; }
        .matrix tbody tr:last-child th, .matrix tbody tr:last-child td { border-bottom: none; }
        .matrix-corner { background: transparent; }
        .matrix thead th { color: var(--color-muted); font-weight: 600; font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; background: var(--color-muted-bg); }
        .matrix tbody th { text-align: left; color: var(--color-muted); font-weight: 600; font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; background: var(--color-muted-bg); display: flex; align-items: center; gap: 8px; padding: 10px 12px; min-height: 38px; }
        .matrix-col-code, .matrix-row-code { font-family: var(--font-mono); }
        .matrix-mark { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: var(--radius-full); font-size: 14px; line-height: 1; }
        .matrix-mark--on { color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 14%, transparent); }
        .matrix-mark--off { color: var(--color-border-strong, var(--color-border)); }
        .matrix-mark--self { color: var(--color-muted); }
        .matrix-self { background: var(--color-muted-bg); }

        @media (max-width: 1100px) {
          .flow-row { flex-direction: column; align-items: flex-start; }
          .flow-cell { width: 100%; }
          .flow-arrow { transform: rotate(90deg); margin: 4px 0 4px 18px; }
          .flow-divider { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}
