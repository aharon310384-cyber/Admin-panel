import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { prisma } from "@/lib/prisma";
import { clientCompanyId, companyTariffs, countryNames, groupBySection } from "@/lib/tariffs";
import { countriesNote, formatServicePrice, formatShippingPrice, formatTariffDays } from "@/lib/tariff-format";

export const metadata: Metadata = { title: "Тарифы" };

// Цвет метки вида доставки; «по запросу» — серым.
const MODE_COLOR: Record<string, string> = {
  TRUCK: "var(--cab-orange)",
  AIR: "var(--cab-blue)",
  SEA: "var(--cab-mint)",
  TRAIN: "var(--cab-green)",
};

type Tariff = Prisma.ShippingTariffGetPayload<{ include: { deliveryMethod: { select: { nameRu: true } } } }>;

function TariffRows({ rows, names }: { rows: Tariff[]; names: Map<string, string> }) {
  return (
    <tbody>
      {rows.map((t) => {
        const note = countriesNote(t.countryCodes, t.direction, names);
        return (
          <tr key={t.id}>
            <td>
              <div className="tf-route">
                <span
                  className="tf-mode"
                  style={{ ["--m" as string]: t.onRequest ? "var(--cab-muted)" : (MODE_COLOR[t.deliveryType] ?? "var(--cab-blue)") }}
                >
                  {t.onRequest ? "Запрос" : t.deliveryMethod.nameRu}
                </span>
                <div className="tf-route-id">
                  <span className="tf-route-title">{t.direction}</span>
                  {t.cargoType && <span className="tf-route-note">{t.cargoType}</span>}
                  {note && <span className="tf-route-note">{note}</span>}
                </div>
              </div>
            </td>
            <td className="tf-tabular">{formatShippingPrice(t)}</td>
            <td className="tf-tabular tf-nowrap">{formatTariffDays(t)}</td>
            <td className="tf-target">{t.deliveryTarget}</td>
          </tr>
        );
      })}
    </tbody>
  );
}

export default async function ClientCabinetTariffsPage() {
  await getClientCabinetContext();

  // Тарифы компании кабинета — из «Логистика → Тарифы» в админке
  const companyId = await clientCompanyId();
  const [company, tariffs, names] = await Promise.all([
    companyId ? prisma.company.findUnique({ where: { id: companyId }, select: { tagline: true, tariffsUrl: true } }) : null,
    companyId ? companyTariffs(companyId, { activeOnly: true }) : { shipping: [], services: [] },
    countryNames(),
  ]);
  const sections = groupBySection(tariffs.shipping);
  const priced = tariffs.shipping.filter((t) => !t.onRequest);
  const prices = priced.map((t) => Number(t.pricePerKgUsd));
  const minDays = tariffs.shipping.map((t) => t.minDays).filter((d): d is number => d != null);
  const maxDays = tariffs.shipping.map((t) => t.maxDays).filter((d): d is number => d != null);
  const tagline = company?.tagline ? company.tagline.charAt(0).toUpperCase() + company.tagline.slice(1) : null;

  return (
    <div className="tf">
      <header className="tf-hero">
        <span className="tf-hero-eyebrow">{tagline ? `${tagline} · USD` : "Цены в USD"}</span>
        <h1 className="tf-hero-title">Тарифы</h1>

        {prices.length > 0 && (
          <div className="tf-spread">
            <div className="tf-spread-ends">
              <div className="tf-spread-end">
                <span className="tf-spread-cap">от</span>
                <strong className="tf-spread-val">${Math.min(...prices)}</strong>
                <span className="tf-spread-unit">/кг</span>
              </div>
              <div className="tf-spread-end tf-spread-end--max">
                <span className="tf-spread-cap">до</span>
                <strong className="tf-spread-val">${Math.max(...prices)}</strong>
                <span className="tf-spread-unit">/кг</span>
              </div>
            </div>
            <div className="tf-spread-rail" aria-hidden="true" />
            <p className="tf-spread-hint">Разброс ставок зависит от направления и способа доставки</p>
          </div>
        )}

        <div className="tf-stats">
          <div className="tf-stat">
            <strong>{tariffs.shipping.length}</strong>
            <span>направлений</span>
          </div>
          {minDays.length > 0 && maxDays.length > 0 && (
            <div className="tf-stat">
              <strong>{Math.min(...minDays)}–{Math.max(...maxDays)}</strong>
              <span>дней в пути</span>
            </div>
          )}
          <div className="tf-stat">
            <strong>{tariffs.services.length}</strong>
            <span>доп. услуг</span>
          </div>
        </div>
      </header>

      {sections.map((group) => (
        <section key={group.section} className="tf-card">
          <div className="tf-section-head">
            <h2 className="tf-section-title">{group.section}</h2>
            <span className="tf-section-note">ставка за кг + оформление</span>
          </div>
          <div className="tf-table-wrap">
            <table className="tf-table">
              <thead>
                <tr>
                  <th>Направление</th>
                  <th>Стоимость</th>
                  <th>Срок</th>
                  <th>Доставка</th>
                </tr>
              </thead>
              <TariffRows rows={group.rows} names={names} />
            </table>
          </div>
        </section>
      ))}

      {tariffs.services.length > 0 && (
        <section className="tf-card">
          <div className="tf-section-head">
            <h2 className="tf-section-title">Дополнительные услуги</h2>
          </div>
          <div className="tf-table-wrap">
            <table className="tf-table">
              <thead>
                <tr>
                  <th>Услуга</th>
                  <th>Описание</th>
                  <th>Цена</th>
                </tr>
              </thead>
              <tbody>
                {tariffs.services.map((s) => (
                  <tr key={s.code}>
                    <td className="tf-route-title">{s.name}</td>
                    <td className="tf-dest">{s.description}</td>
                    <td className="tf-tabular tf-svc-price">{formatServicePrice(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {company?.tariffsUrl && (
        <a
          href={company.tariffsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tf-source"
        >
          <ExternalLink size={15} />
          Открыть тарифы на сайте
        </a>
      )}

      <style>{`
        .tf { display: flex; flex-direction: column; gap: 18px; padding-bottom: 8px; }

        .tf-hero {
          display: flex; flex-direction: column; gap: 16px; padding: 22px 20px 20px;
          border-radius: var(--cab-radius-lg);
          background:
            radial-gradient(130% 120% at 0% 0%, color-mix(in srgb, var(--cab-green) 20%, transparent) 0%, transparent 55%),
            radial-gradient(130% 120% at 100% 100%, color-mix(in srgb, var(--cab-orange-light) 16%, transparent) 0%, transparent 50%),
            var(--cab-surface);
          border: 1px solid color-mix(in srgb, var(--cab-green) 18%, var(--cab-border));
          box-shadow: var(--cab-shadow-md);
        }
        .tf-hero-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--cab-green-deep); }
        .tf-hero-title { margin: -6px 0 0; font-family: var(--font-space-grotesk), sans-serif; font-size: 34px; font-weight: 700; letter-spacing: -0.03em; }

        .tf-spread { display: flex; flex-direction: column; gap: 10px; }
        .tf-spread-ends { display: flex; align-items: flex-end; justify-content: space-between; }
        .tf-spread-end { display: flex; align-items: baseline; gap: 4px; }
        .tf-spread-cap { font-size: 12px; font-weight: 600; color: var(--cab-muted); margin-right: 2px; }
        .tf-spread-val { font-family: var(--font-space-grotesk), sans-serif; font-size: 32px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; color: var(--cab-green-deep); }
        .tf-spread-end--max .tf-spread-val { color: var(--cab-orange); }
        .tf-spread-unit { font-size: 13px; font-weight: 600; color: var(--cab-muted); }
        .tf-spread-rail {
          height: 8px; border-radius: 999px;
          background: linear-gradient(90deg, var(--cab-green) 0%, var(--cab-mint) 38%, var(--cab-amber) 70%, var(--cab-orange) 100%);
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);
        }
        .tf-spread-hint { margin: 0; font-size: 11.5px; color: var(--cab-muted); }

        .tf-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .tf-stat {
          display: flex; flex-direction: column; gap: 2px; padding: 12px; border-radius: var(--cab-radius-sm);
          background: color-mix(in srgb, var(--cab-bg) 50%, var(--cab-surface)); border: 1px solid var(--cab-border);
        }
        .tf-stat strong { font-family: var(--font-space-grotesk), sans-serif; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .tf-stat span { font-size: 11px; color: var(--cab-muted); }

        .tf-card {
          background: var(--cab-surface); border: 1px solid var(--cab-border);
          border-radius: var(--cab-radius-md); box-shadow: var(--cab-shadow-sm); overflow: hidden;
        }
        .tf-section-head {
          display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
          padding: 16px 18px 13px; border-bottom: 1px solid var(--cab-border); flex-wrap: wrap;
        }
        .tf-section-title { margin: 0; font-size: 15px; font-weight: 700; }
        .tf-section-note { font-size: 11.5px; color: var(--cab-muted); }

        .tf-table-wrap { overflow-x: auto; }
        .tf-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .tf-table th {
          text-align: left; padding: 11px 16px; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em; color: var(--cab-muted);
          border-bottom: 1px solid var(--cab-border); white-space: nowrap; background: color-mix(in srgb, var(--cab-bg) 45%, var(--cab-surface));
        }
        .tf-table td { padding: 13px 16px; border-bottom: 1px solid var(--cab-border); color: var(--cab-text); vertical-align: middle; }
        .tf-table tbody tr:last-child td { border-bottom: none; }
        .tf-table tbody tr:hover td { background: color-mix(in srgb, var(--cab-green) 5%, transparent); }

        .tf-route { display: flex; align-items: center; gap: 10px; min-width: 230px; }
        .tf-route-id { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .tf-route-title { font-weight: 600; line-height: 1.3; }
        .tf-route-note { font-size: 11.5px; color: var(--cab-muted); }
        .tf-dest { color: var(--cab-text-soft); }
        .tf-tabular { font-variant-numeric: tabular-nums; }
        .tf-nowrap { white-space: nowrap; }
        .tf-target { font-size: 12.5px; color: var(--cab-muted); }
        .tf-svc-price { font-weight: 700; color: var(--cab-green-deep); white-space: nowrap; }

        .tf-mode {
          flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
          min-width: 54px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; line-height: 1;
          color: color-mix(in srgb, var(--m) 80%, var(--cab-text));
          background: color-mix(in srgb, var(--m) 15%, transparent);
          border: 1px solid color-mix(in srgb, var(--m) 28%, transparent);
        }

        .tf-source {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 13px; border-radius: var(--cab-radius-md); font-size: 14px; font-weight: 600;
          color: var(--cab-green-deep); text-decoration: none; background: var(--cab-surface);
          border: 1px solid color-mix(in srgb, var(--cab-green) 26%, var(--cab-border));
          transition: background 0.15s;
        }
        .tf-source:hover { background: color-mix(in srgb, var(--cab-green) 8%, var(--cab-surface)); }

        @media (min-width: 1024px) {
          .tf-source { align-self: start; padding-left: 28px; padding-right: 28px; }
        }
      `}</style>
    </div>
  );
}
