import type { Metadata } from "next";
import { MapPin, Package, Users } from "lucide-react";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { dedupeCustomers } from "@/lib/customer-dedupe";
import { prisma } from "@/lib/prisma";
import { ParcelStatusBadge } from "@/components/ui/status-badge";
import { formatCny, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Обзор",
};

function dash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function clientDisplayName(client: { code: string; name: string }): string | null {
  const name = client.name.trim();

  if (!name || name.toLowerCase() === client.code.trim().toLowerCase()) {
    return null;
  }

  return name;
}

function recipientName(recipient: {
  name: string;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
}): string {
  return (
    [recipient.lastName, recipient.firstName, recipient.middleName]
      .filter(Boolean)
      .join(" ") || dash(recipient.name)
  );
}

export default async function ClientCabinetPage() {
  const { client } = await getClientCabinetContext();
  const codeVariants = Array.from(
    new Set([client.code, client.code.toUpperCase(), client.code.toLowerCase()])
  );

  const [recipientRecords, recentOrders] = await Promise.all([
    prisma.customer.findMany({
      where: {
        deletedAt: null,
        id: { not: client.id },
        clientCode: { in: codeVariants },
      },
      select: {
        id: true,
        code: true,
        clientCode: true,
        name: true,
        lastName: true,
        firstName: true,
        middleName: true,
        country: true,
        city: true,
        postalCode: true,
        address: true,
        phone: true,
        informationDate: true,
        sourceRow: true,
      },
      orderBy: [{ informationDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.parcel.findMany({
      where: {
        deletedAt: null,
        routePrefix: { in: codeVariants },
      },
      select: {
        id: true,
        number: true,
        recipientName: true,
        status: true,
        totalCny: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const recipients = dedupeCustomers(recipientRecords);
  const location = [client.country, client.city].filter(Boolean).join(" / ");
  const displayName = clientDisplayName(client);

  return (
    <div className="client-cabinet-page">
      <div className="client-cabinet-page-header">
        <div>
          <p className="client-cabinet-eyebrow">Личный кабинет</p>
          <h1 className="client-cabinet-title">
            <span className="client-cabinet-code">{client.code}</span>
            {displayName ? <span>{displayName}</span> : null}
          </h1>
          <p className="client-cabinet-subtitle">
            Контактные данные, получатели и последние посылки клиента
          </p>
        </div>

        <div className="client-cabinet-summary" aria-label="Краткая статистика">
          <div className="client-cabinet-summary-item">
            <Users size={17} aria-hidden="true" />
            <span>
              <strong>{recipients.length}</strong>
              Получатели
            </span>
          </div>
          <div className="client-cabinet-summary-item">
            <Package size={17} aria-hidden="true" />
            <span>
              <strong>{recentOrders.length}</strong>
              Последние посылки
            </span>
          </div>
        </div>
      </div>

      <section className="client-cabinet-card" aria-labelledby="client-data-title">
        <div className="client-cabinet-card-header">
          <div>
            <p className="client-cabinet-card-kicker">Профиль</p>
            <h2 id="client-data-title" className="client-cabinet-card-title">
              Данные клиента
            </h2>
          </div>
          {location ? (
            <span className="client-cabinet-location">
              <MapPin size={14} aria-hidden="true" />
              {location}
            </span>
          ) : null}
        </div>

        <dl className="client-cabinet-info-grid">
          <div className="client-cabinet-info-item">
            <dt>КОД_КЛИЕНТА</dt>
            <dd className="client-cabinet-mono">{dash(client.code)}</dd>
          </div>
          <div className="client-cabinet-info-item">
            <dt>Фамилия</dt>
            <dd>{dash(client.lastName)}</dd>
          </div>
          <div className="client-cabinet-info-item">
            <dt>Имя</dt>
            <dd>{dash(client.firstName)}</dd>
          </div>
          <div className="client-cabinet-info-item">
            <dt>Отчество</dt>
            <dd>{dash(client.middleName)}</dd>
          </div>
          <div className="client-cabinet-info-item">
            <dt>Email</dt>
            <dd>{dash(client.email)}</dd>
          </div>
          <div className="client-cabinet-info-item">
            <dt>Telegram</dt>
            <dd>{dash(client.username)}</dd>
          </div>
          <div className="client-cabinet-info-item">
            <dt>Телефон</dt>
            <dd>{dash(client.phone)}</dd>
          </div>
          <div className="client-cabinet-info-item">
            <dt>Страна / город</dt>
            <dd>{location || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="client-cabinet-card client-cabinet-card--table" aria-labelledby="recipients-title">
        <div className="client-cabinet-card-header client-cabinet-card-header--table">
          <div>
            <p className="client-cabinet-card-kicker">Адресная книга</p>
            <h2 id="recipients-title" className="client-cabinet-card-title">
              Получатели
            </h2>
          </div>
          <span className="client-cabinet-count">{recipients.length}</span>
        </div>

        <div className="client-cabinet-table-wrap">
          <table className="client-cabinet-table" aria-label="Получатели клиента">
            <thead>
              <tr>
                <th>Получатель</th>
                <th>Страна / город</th>
                <th>Почтовый код</th>
                <th>Адрес</th>
                <th>Телефон</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((recipient) => (
                <tr key={recipient.id}>
                  <td>{recipientName(recipient)}</td>
                  <td className="client-cabinet-muted">
                    {[recipient.country, recipient.city].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="client-cabinet-mono client-cabinet-muted">
                    {dash(recipient.postalCode)}
                  </td>
                  <td className="client-cabinet-address">{dash(recipient.address)}</td>
                  <td className="client-cabinet-muted">{dash(recipient.phone)}</td>
                </tr>
              ))}
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="client-cabinet-empty">
                    Получатели пока не добавлены
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="client-cabinet-card client-cabinet-card--table" aria-labelledby="orders-title">
        <div className="client-cabinet-card-header client-cabinet-card-header--table">
          <div>
            <p className="client-cabinet-card-kicker">История</p>
            <h2 id="orders-title" className="client-cabinet-card-title">
              Последние посылки
            </h2>
          </div>
          <span className="client-cabinet-count">{recentOrders.length}</span>
        </div>

        <div className="client-cabinet-table-wrap">
          <table className="client-cabinet-table" aria-label="Последние посылки клиента">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Номер</th>
                <th>Получатель</th>
                <th>Статус</th>
                <th>К оплате ¥</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="client-cabinet-muted">{formatDateTime(order.createdAt)}</td>
                  <td className="client-cabinet-mono">{order.number}</td>
                  <td>{dash(order.recipientName)}</td>
                  <td>
                    <ParcelStatusBadge status={order.status} />
                  </td>
                  <td className="client-cabinet-tabular">{formatCny(order.totalCny)}</td>
                </tr>
              ))}
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="client-cabinet-empty">
                    Посылок пока нет
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .client-cabinet-page { display: flex; flex-direction: column; gap: 20px; }
        .client-cabinet-page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding: 4px 0; }
        .client-cabinet-eyebrow, .client-cabinet-card-kicker { margin: 0 0 5px; color: var(--color-accent); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .client-cabinet-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0; color: var(--color-text); font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
        .client-cabinet-code { display: inline-flex; align-items: center; justify-content: center; min-height: 32px; padding: 5px 11px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text); background: var(--color-muted-bg); font-family: var(--font-jetbrains-mono), monospace; font-size: 15px; letter-spacing: 0; }
        .client-cabinet-subtitle { margin: 6px 0 0; color: var(--color-muted); font-size: 13px; }

        .client-cabinet-summary { display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap; }
        .client-cabinet-summary-item { min-width: 132px; display: flex; align-items: center; gap: 9px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-accent); background: var(--color-surface); }
        .client-cabinet-summary-item span { display: flex; flex-direction: column; gap: 1px; color: var(--color-muted); font-size: 11px; line-height: 1.2; }
        .client-cabinet-summary-item strong { color: var(--color-text); font-size: 15px; font-variant-numeric: tabular-nums; }

        .client-cabinet-card { padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); box-shadow: var(--shadow-card); overflow: hidden; }
        .client-cabinet-card--table { padding: 0; }
        .client-cabinet-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
        .client-cabinet-card-header--table { align-items: center; margin: 0; padding: 18px 20px 14px; border-bottom: 1px solid var(--color-border); }
        .client-cabinet-card-title { margin: 0; color: var(--color-text); font-size: 15px; font-weight: 700; }
        .client-cabinet-location { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: var(--radius-full); color: var(--color-muted); background: var(--color-muted-bg); font-size: 12px; white-space: nowrap; }
        .client-cabinet-count { display: inline-flex; min-width: 26px; height: 26px; align-items: center; justify-content: center; padding: 0 8px; border-radius: var(--radius-full); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 10%, transparent); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }

        .client-cabinet-info-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin: 0; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; }
        .client-cabinet-info-item { min-width: 0; padding: 13px 14px; border-right: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
        .client-cabinet-info-item:nth-child(4n) { border-right: none; }
        .client-cabinet-info-item:nth-last-child(-n + 4) { border-bottom: none; }
        .client-cabinet-info-item dt { margin: 0 0 5px; color: var(--color-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
        .client-cabinet-info-item dd { margin: 0; overflow-wrap: anywhere; color: var(--color-text); font-size: 13px; line-height: 1.4; }

        .client-cabinet-table-wrap { overflow-x: auto; }
        .client-cabinet-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .client-cabinet-table th { padding: 9px 20px; border-bottom: 1px solid var(--color-border); color: var(--color-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.05em; text-align: left; text-transform: uppercase; white-space: nowrap; }
        .client-cabinet-table td { padding: 12px 20px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: top; }
        .client-cabinet-table tbody tr:last-child td { border-bottom: none; }
        .client-cabinet-table tbody tr:hover td { background: var(--color-muted-bg); }
        .client-cabinet-address { min-width: 220px; max-width: 360px; }
        .client-cabinet-muted { color: var(--color-muted) !important; }
        .client-cabinet-mono { font-family: var(--font-jetbrains-mono), monospace; font-size: 12px; }
        .client-cabinet-tabular { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .client-cabinet-empty { padding: 30px 20px !important; color: var(--color-muted) !important; text-align: center; }

        @media (max-width: 960px) {
          .client-cabinet-info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .client-cabinet-info-item:nth-child(4n) { border-right: 1px solid var(--color-border); }
          .client-cabinet-info-item:nth-child(2n) { border-right: none; }
          .client-cabinet-info-item:nth-last-child(-n + 4) { border-bottom: 1px solid var(--color-border); }
          .client-cabinet-info-item:nth-last-child(-n + 2) { border-bottom: none; }
        }

        @media (max-width: 600px) {
          .client-cabinet-page-header { align-items: stretch; }
          .client-cabinet-summary { display: grid; grid-template-columns: 1fr 1fr; }
          .client-cabinet-summary-item { min-width: 0; }
          .client-cabinet-info-grid { grid-template-columns: 1fr; }
          .client-cabinet-info-item, .client-cabinet-info-item:nth-child(2n), .client-cabinet-info-item:nth-child(4n) { border-right: none; }
          .client-cabinet-info-item:nth-last-child(-n + 2) { border-bottom: 1px solid var(--color-border); }
          .client-cabinet-info-item:last-child { border-bottom: none; }
        }
      `}</style>
    </div>
  );
}
