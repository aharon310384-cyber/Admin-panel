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

// Справочник статусов посылки (модель v2). Счётчики — иллюстративные.
const MAIN_FLOW: StatusNode[] = [
  { code: "FORMED", description: "Новая — собрана из принятых заказов", count: 0 },
  { code: "ASSEMBLED", description: "Заказы собраны вместе", count: 0 },
  { code: "PACKED", description: "Упакована к отправке", count: 0 },
  { code: "READY_TO_SHIP", description: "Готова к отправке, формируется квитанция", count: 0 },
  { code: "SHIPPED", description: "Отправлена, в пути", count: 0 },
  { code: "DELIVERED", description: "Доставлена получателю", count: 0 },
];

const SIDE_FLOW: StatusNode[] = [
  { code: "RETURNED", description: "Возврат (самовывоз / возврат клиенту)", count: 0 },
  { code: "UTILIZED", description: "Утилизирована", count: 0 },
];

const TRANSITIONS: Array<{ from: ParcelStatus; to: ParcelStatus }> = [
  { from: "FORMED", to: "ASSEMBLED" },
  { from: "ASSEMBLED", to: "PACKED" },
  { from: "PACKED", to: "READY_TO_SHIP" },
  { from: "READY_TO_SHIP", to: "SHIPPED" },
  { from: "READY_TO_SHIP", to: "UTILIZED" },
  { from: "SHIPPED", to: "DELIVERED" },
  { from: "SHIPPED", to: "RETURNED" },
  { from: "FORMED", to: "RETURNED" },
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
                    <span className="matrix-row-inner">
                      <span className={`status-dot status-dot--${PARCEL_STATUS_TONE[from.code]}`} aria-hidden="true" />
                      <span className="matrix-row-code">{from.code}</span>
                    </span>
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

        .status-card { width: 220px; padding: 16px 18px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-strong, var(--color-surface)); display: flex; flex-direction: column; gap: 8px; position: relative; }
        .status-card::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 4px; border-radius: 0 2px 2px 0; background: currentColor; opacity: 0.7; }
        .status-card--new { color: var(--color-status-new); }
        .status-card--processing { color: var(--color-status-processing); }
        .status-card--shipped { color: var(--color-status-shipped); }
        .status-card--completed, .status-card--paid { color: var(--color-status-completed); }
        .status-card--canceled { color: var(--color-status-canceled); }
        .status-card--returned-paid { color: var(--color-status-completed); }
        .status-card--returned-unpaid { color: var(--color-status-processing); }

        .status-card-head { display: flex; align-items: center; gap: 8px; }
        .status-card-code { font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em; color: var(--color-muted); }
        .status-card-title { margin: 0; color: var(--color-text); font-size: 16px; font-weight: 600; }
        .status-card-desc { margin: 0; color: var(--color-muted); font-size: 12.5px; line-height: 1.4; min-height: 36px; }
        .status-card-meta { display: flex; align-items: baseline; gap: 6px; margin-top: 4px; }
        .status-card-count { color: var(--color-text); font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
        .status-card-count-label { color: var(--color-muted); font-size: 12px; }

        .matrix-wrap { display: inline-block; max-width: 100%; overflow-x: auto; }
        .matrix { border-collapse: collapse; font-size: 11px; width: auto; }
        .matrix th, .matrix td { padding: 4px 6px; text-align: center; border-bottom: 1px solid var(--color-border); border-right: 1px solid var(--color-border); white-space: nowrap; }
        .matrix th:last-child, .matrix td:last-child { border-right: none; }
        .matrix tbody tr:last-child th, .matrix tbody tr:last-child td { border-bottom: none; }
        .matrix-corner { background: transparent; }
        .matrix thead th { color: var(--color-muted); font-weight: 600; font-size: 10px; letter-spacing: 0.02em; background: var(--color-muted-bg); }
        .matrix tbody th { text-align: left; color: var(--color-muted); font-weight: 600; font-size: 10px; letter-spacing: 0.02em; background: var(--color-muted-bg); padding: 4px 8px 4px 6px; }
        .matrix tbody th .matrix-row-inner { display: inline-flex; align-items: center; gap: 6px; }
        .matrix-col-code, .matrix-row-code { font-family: var(--font-mono); }
        .matrix-mark { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: var(--radius-full); font-size: 11px; line-height: 1; }
        .matrix-mark--on { color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 16%, transparent); }
        .matrix-mark--off { color: color-mix(in srgb, var(--color-muted) 35%, transparent); font-size: 9px; }
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
