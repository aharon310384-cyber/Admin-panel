import type { Metadata } from "next";
import {
  ADDITIONAL_SERVICE_TARIFFS,
  EMS_SHIPPING_TARIFFS,
  MAIN_SHIPPING_TARIFFS,
  POSTMANFOX_TARIFF_SOURCE,
  formatAdditionalServicePrice,
  formatTariffDays,
  formatTariffPrice,
  type ShippingTariff,
} from "@/lib/postmanfox-tariffs";

export const metadata: Metadata = { title: "Тарифы" };

const MODE_LABELS: Record<ShippingTariff["mode"], string> = {
  auto: "Авто",
  air: "Авиа",
  sea: "Море",
  ems: "EMS",
  request: "Запрос",
};

function TariffRows({ rows }: { rows: ShippingTariff[] }) {
  return (
    <tbody>
      {rows.map((tariff) => (
        <tr key={tariff.title}>
          <td>
            <div className="route-cell">
              <span className={`mode-badge mode-badge--${tariff.mode}`}>
                {MODE_LABELS[tariff.mode]}
              </span>
              <div>
                <p className="route-title">{tariff.title}</p>
                {tariff.cargoType && <p className="route-note">{tariff.cargoType}</p>}
              </div>
            </div>
          </td>
          <td>{tariff.destination}</td>
          <td className="tabular">{formatTariffPrice(tariff)}</td>
          <td className="tabular">{formatTariffDays(tariff)}</td>
          <td>{tariff.deliveryTarget}</td>
        </tr>
      ))}
    </tbody>
  );
}

export default function TariffsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Тарифы PostmanFox</h1>
          <p className="page-subtitle">
            Доставка из Китая, USD. Источник обновлен на сайте {POSTMANFOX_TARIFF_SOURCE.pageModifiedAt}.
          </p>
        </div>
        <a
          href={POSTMANFOX_TARIFF_SOURCE.url}
          className="btn-secondary"
          target="_blank"
          rel="noreferrer"
        >
          Открыть источник
        </a>
      </div>

      <div className="summary-grid">
        <div className="metric">
          <span className="metric-label">Основных направлений</span>
          <strong>{MAIN_SHIPPING_TARIFFS.length}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">EMS-групп</span>
          <strong>{EMS_SHIPPING_TARIFFS.length}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Доп. услуг</span>
          <strong>{ADDITIONAL_SERVICE_TARIFFS.length}</strong>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <h2 className="card-title">Основные направления</h2>
          <span className="section-note">Формула: ставка за кг + оформление</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Направление</th>
                <th>Страна</th>
                <th>Стоимость</th>
                <th>Срок</th>
                <th>Доставка</th>
              </tr>
            </thead>
            <TariffRows rows={MAIN_SHIPPING_TARIFFS} />
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2 className="card-title">EMS</h2>
          <span className="section-note">Группы стран для международной доставки</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Группа</th>
                <th>Страны</th>
                <th>Стоимость</th>
                <th>Срок</th>
                <th>Доставка</th>
              </tr>
            </thead>
            <TariffRows rows={EMS_SHIPPING_TARIFFS} />
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2 className="card-title">Дополнительные услуги</h2>
          <span className="section-note">Для расчета упаковки, консолидации, проверки и страховки</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Услуга</th>
                <th>Описание</th>
                <th>Цена</th>
              </tr>
            </thead>
            <tbody>
              {ADDITIONAL_SERVICE_TARIFFS.map((service) => (
                <tr key={service.title}>
                  <td className="service-title">{service.title}</td>
                  <td>{service.description}</td>
                  <td className="tabular">{formatAdditionalServicePrice(service)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }
        .btn-secondary { display: inline-flex; align-items: center; padding: 9px 16px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-text); text-decoration: none; transition: background 0.15s; white-space: nowrap; }
        .btn-secondary:hover { background: var(--color-muted-bg); }

        .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .metric { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-card); }
        .metric-label { display: block; color: var(--color-muted); font-size: 12px; margin-bottom: 6px; }
        .metric strong { color: var(--color-text); font-size: 24px; font-variant-numeric: tabular-nums; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
        .card-title { font-size: 15px; font-weight: 700; margin: 0; color: var(--color-text); }
        .section-note { color: var(--color-muted); font-size: 12px; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 13px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: top; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .route-cell { display: flex; align-items: flex-start; gap: 10px; min-width: 230px; }
        .route-title, .route-note { margin: 0; }
        .route-title, .service-title { font-weight: 600; }
        .route-note { color: var(--color-muted); font-size: 12px; margin-top: 3px; }
        .tabular { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .mode-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 54px; padding: 4px 8px; border-radius: var(--radius-full); font-size: 11px; font-weight: 800; line-height: 1; }
        .mode-badge--auto { color: var(--color-status-processing); background: var(--color-status-processing-bg); }
        .mode-badge--air { color: var(--color-status-new); background: var(--color-status-new-bg); }
        .mode-badge--sea { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
        .mode-badge--ems { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .mode-badge--request { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }

        @media (max-width: 720px) {
          .summary-grid { grid-template-columns: 1fr; }
          .table { font-size: 13px; }
        }
      `}</style>
    </div>
  );
}
