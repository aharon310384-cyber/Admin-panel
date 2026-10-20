import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientCompanyId, companyTariffs, countryNames, groupBySection } from "@/lib/tariffs";
import { countriesNote, formatServicePrice, formatShippingPrice, formatTariffDays } from "@/lib/tariff-format";
import ClickableRow from "@/components/ui/clickable-row";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Тарифы" };

// Цвет метки вида доставки; «по запросу» — серым.
const MODE_CLASS: Record<string, string> = { TRUCK: "auto", AIR: "air", SEA: "sea", TRAIN: "ems" };

export default async function TariffsPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const [companies, clientId] = await Promise.all([
    prisma.company.findMany({
      select: { id: true, name: true, tariffsUrl: true, _count: { select: { shippingTariffs: true } } },
      orderBy: { createdAt: "asc" },
    }),
    clientCompanyId(),
  ]);
  const company = companies.find((item) => item.id === params.company) ?? companies.find((item) => item.id === clientId) ?? companies[0];

  if (!company) {
    return (
      <Form formKey="tariffs" title="Тарифы">
        <p className="muted">Сначала заведите компанию: «Администрирование → Компании».</p>
      </Form>
    );
  }

  const [{ shipping, services }, names] = await Promise.all([companyTariffs(company.id), countryNames()]);
  const sections = groupBySection(shipping);

  return (
    <>
      <Form
        formKey="tariffs"
        title={`Тарифы ${company.name}`}
        commands={
          <>
            {isAdmin && (
              <Link href={`/tariffs/new?company=${company.id}`} className="cmd cmd--primary" data-command="create">
                <Plus size={15} />
                Создать тариф
              </Link>
            )}
            {company.tariffsUrl && (
              <a href={company.tariffsUrl} className="cmd" data-command="source" target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
                Открыть на сайте
              </a>
            )}
          </>
        }
        footer="Цены в USD. Тариф посылки выбирается по стране получателя и виду доставки; если подходят несколько — первый по порядку. Двойной щелчок по строке — карточка."
      >
        {companies.length > 1 && (
          <nav className="company-tabs" aria-label="Компании">
            {companies.map((item) => (
              <Link
                key={item.id}
                href={`/tariffs?company=${item.id}`}
                className={`company-tab ${item.id === company.id ? "company-tab--active" : ""}`}
              >
                {item.name}
                <span className="company-tab-count">{item._count.shippingTariffs}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="summary-grid">
          {sections.map((group) => (
            <div key={group.section} className="metric">
              <span className="metric-label">{group.section}</span>
              <strong>{group.rows.filter((row) => row.active).length}</strong>
            </div>
          ))}
          <div className="metric">
            <span className="metric-label">Доп. услуг</span>
            <strong>{services.filter((service) => service.active && service.inPriceList).length}</strong>
          </div>
        </div>

        {sections.length === 0 && (
          <section className="card">
            <p className="empty">У компании пока нет тарифов доставки.{isAdmin && <> Нажмите «Создать тариф».</>}</p>
          </section>
        )}

        {sections.map((group) => (
          <section key={group.section} className="card">
            <div className="section-head">
              <h2 className="card-title">{group.section}</h2>
              <span className="section-note">Формула: ставка за кг + оформление</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Направление</th>
                    <th>Стоимость</th>
                    <th>Срок</th>
                    <th>Доставка</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((tariff) => {
                    const note = countriesNote(tariff.countryCodes, tariff.direction, names);
                    return (
                      <ClickableRow key={tariff.id} href={`/tariffs/${tariff.id}`} className={tariff.active ? undefined : "row--off"}>
                        <td>
                          <div className="route-cell">
                            <span className={`mode-badge mode-badge--${tariff.onRequest ? "request" : (MODE_CLASS[tariff.deliveryType] ?? "air")}`}>
                              {tariff.onRequest ? "Запрос" : tariff.deliveryMethod.nameRu}
                            </span>
                            <div>
                              <p className="route-title">
                                <Link href={`/tariffs/${tariff.id}`} className="route-link">{tariff.direction}</Link>
                                {!tariff.active && <span className="off-tag">не действует</span>}
                              </p>
                              {tariff.cargoType && <p className="route-note">{tariff.cargoType}</p>}
                              {note && <p className="route-note">{note}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="tabular">{formatShippingPrice(tariff)}</td>
                        <td className="tabular">{formatTariffDays(tariff)}</td>
                        <td>{tariff.deliveryTarget ?? "—"}</td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}

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
                {services.map((service) => (
                  <ClickableRow key={service.code} href={`/tariffs/services/${service.code}`} className={service.active ? undefined : "row--off"}>
                    <td className="service-title">
                      <Link href={`/tariffs/services/${service.code}`} className="route-link">{service.name}</Link>
                      {!service.active && <span className="off-tag">не действует</span>}
                      {service.active && !service.inPriceList && <span className="off-tag">не в прайсе</span>}
                    </td>
                    <td>{service.description ?? "—"}</td>
                    <td className="tabular">{formatServicePrice(service)}</td>
                  </ClickableRow>
                ))}
                {services.length === 0 && (
                  <tr><td colSpan={3} className="empty">Услуг у компании нет.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </Form>

      <style>{`
        .company-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .company-tab { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: 13px; color: var(--color-text-secondary); text-decoration: none; background: var(--color-surface); }
        .company-tab:hover { background: var(--color-muted-bg); }
        .company-tab--active { color: var(--color-accent); border-color: var(--color-accent); font-weight: 600; }
        .company-tab-count { font-size: 11px; color: var(--color-muted); font-variant-numeric: tabular-nums; }

        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
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
        .row--off td { color: var(--color-muted); }
        .route-cell { display: flex; align-items: flex-start; gap: 10px; min-width: 230px; }
        .route-title, .route-note { margin: 0; }
        .route-title, .service-title { font-weight: 600; }
        .route-link { color: inherit; text-decoration: none; }
        .route-link:hover { color: var(--color-accent); }
        .route-note { color: var(--color-muted); font-size: 12px; margin-top: 3px; max-width: 520px; }
        .off-tag { display: inline-flex; margin-left: 8px; padding: 1px 7px; border-radius: var(--radius-full); font-size: 11px; font-weight: 600; color: var(--color-muted); background: var(--color-muted-bg); vertical-align: middle; }
        .tabular { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .empty { margin: 0; padding: 16px 20px; color: var(--color-muted); font-size: 13px; }
        .muted { color: var(--color-muted); }
        .mode-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 54px; padding: 4px 8px; border-radius: var(--radius-full); font-size: 11px; font-weight: 800; line-height: 1; }
        .mode-badge--auto { color: var(--color-status-processing); background: var(--color-status-processing-bg); }
        .mode-badge--air { color: var(--color-status-new); background: var(--color-status-new-bg); }
        .mode-badge--sea { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
        .mode-badge--ems { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .mode-badge--request { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }

        @media (max-width: 720px) {
          .table { font-size: 13px; }
        }
      `}</style>
    </>
  );
}
