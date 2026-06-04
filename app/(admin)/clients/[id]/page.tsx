import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Customer } from "@prisma/client";
import { auth } from "@/auth";
import { enterClientCabinet } from "@/actions/client-cabinet";
import { prisma } from "@/lib/prisma";
import { formatCny, formatDateTime } from "@/lib/utils";
import { ParcelStatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Карточка клиента" };

function dash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['`’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePostalCode(value: string | null | undefined): string {
  return normalizeIdentity(value).replace(/[\s-]/g, "");
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function recipientKey(customer: Customer): string {
  const fallbackName = customer.lastName || customer.name;

  return [
    normalizeIdentity(fallbackName),
    normalizeIdentity(customer.firstName),
    normalizeIdentity(customer.middleName),
    normalizeIdentity(customer.country),
    normalizeIdentity(customer.city),
    normalizePostalCode(customer.postalCode),
    normalizePhone(customer.phone),
  ].join("|");
}

function dedupeRecipients(customers: Customer[]): Customer[] {
  const byKey = new Map<string, Customer>();

  for (const customer of customers) {
    const key = recipientKey(customer);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, customer);
      continue;
    }

    const existingScore = existing.informationDate?.getTime() ?? 0;
    const candidateScore = customer.informationDate?.getTime() ?? 0;
    if (candidateScore > existingScore) {
      byKey.set(key, customer);
    }
  }

  return [...byKey.values()];
}

function clientDisplayName(client: Customer): string {
  if (client.code && client.name.trim().toLowerCase() === client.code.trim().toLowerCase()) {
    return client.code;
  }

  return dash(client.name);
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const client = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
  });

  if (!client) notFound();

  const code = client.code?.trim();
  const codeUpper = code?.toUpperCase();

  const codeVariants = code ? Array.from(new Set([code, code.toUpperCase(), code.toLowerCase()])) : [];

  const [recipientRecords, orderGroup, recentOrders] = await Promise.all([
    codeVariants.length
      ? prisma.customer.findMany({
          where: {
            deletedAt: null,
            id: { not: client.id },
            clientCode: { in: codeVariants },
          },
        })
      : Promise.resolve<Customer[]>([]),
    codeVariants.length
      ? prisma.parcel.count({
          where: {
            deletedAt: null,
            routePrefix: { in: codeVariants },
          },
        })
      : Promise.resolve(0),
    codeVariants.length
      ? prisma.parcel.findMany({
          where: {
            deletedAt: null,
            routePrefix: { in: codeVariants },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  const recipients = dedupeRecipients(recipientRecords).sort((a, b) => {
    return (
      (b.informationDate?.getTime() ?? 0) - (a.informationDate?.getTime() ?? 0)
    );
  });

  const orderCount = orderGroup;
  const totalCny = recentOrders
    .filter((o) => o.status !== "CANCELED")
    .reduce((sum, o) => sum + Number(o.totalCny), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/clients" className="breadcrumb-link">Клиенты</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{client.code ?? clientDisplayName(client)}</span>
          </div>
          <h1 className="page-title">
            {client.code && (
              <span className="code-pill code-pill--lg">{client.code}</span>
            )}
            <span className="page-title-name">{clientDisplayName(client)}</span>
          </h1>
        </div>
        {isAdmin && client.code && (
          <form action={enterClientCabinet.bind(null, client.id)}>
            <button type="submit" className="btn-primary">
              Войти как клиент
            </button>
          </form>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <h2 className="card-title">Контактные данные</h2>
          <dl className="info-list">
            <div className="info-row"><dt>КОД_КЛИЕНТА</dt><dd>{dash(client.code)}</dd></div>
            <div className="info-row"><dt>Фамилия</dt><dd>{dash(client.lastName)}</dd></div>
            <div className="info-row"><dt>Имя</dt><dd>{dash(client.firstName)}</dd></div>
            <div className="info-row"><dt>Отчество</dt><dd>{dash(client.middleName)}</dd></div>
            <div className="info-row"><dt>Email</dt><dd>{dash(client.email)}</dd></div>
            <div className="info-row"><dt>Telegram</dt><dd>{dash(client.username)}</dd></div>
            <div className="info-row"><dt>Телефон</dt><dd>{dash(client.phone)}</dd></div>
            <div className="info-row"><dt>Страна</dt><dd>{dash(client.country)}</dd></div>
            <div className="info-row"><dt>Город</dt><dd>{dash(client.city)}</dd></div>
          </dl>
        </div>

        <div className="card">
          <h2 className="card-title">Статистика</h2>
          <div className="stats-grid">
            <div className="stat">
            <p className="stat-label">Посылок</p>
              <p className="stat-value">{orderCount}</p>
              <p className="stat-hint">по префиксу {dash(codeUpper)}</p>
            </div>
            <div className="stat">
              <p className="stat-label">Получателей</p>
              <p className="stat-value">{recipients.length}</p>
              <p className="stat-hint">уникальных, без дублей</p>
            </div>
            <div className="stat">
              <p className="stat-label">Сумма последних 10 ¥</p>
              <p className="stat-value">{formatCny(totalCny)}</p>
              <p className="stat-hint">без отменённых</p>
            </div>
          </div>
        </div>

        <div className="card card--full">
          <h2 className="card-title">Получатели клиента ({recipients.length})</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Фамилия</th>
                  <th>Имя</th>
                  <th>Отчество</th>
                  <th>Страна / город</th>
                  <th>Почтовый код</th>
                  <th>Адрес</th>
                  <th>Телефон</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td>{dash(r.lastName ?? r.name)}</td>
                    <td>{dash(r.firstName)}</td>
                    <td>{dash(r.middleName)}</td>
                    <td className="text-muted">
                      {[r.country, r.city].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="mono text-muted">{dash(r.postalCode)}</td>
                    <td className="address-cell">{dash(r.address)}</td>
                    <td className="text-muted">{dash(r.phone)}</td>
                    <td>
                      <Link href={`/recipients/${r.id}`} className="btn-ghost btn-sm">
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr><td colSpan={8} className="table-empty">Получатели не найдены</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card--full">
          <h2 className="card-title">Последние посылки ({recentOrders.length})</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Номер</th>
                  <th>Получатель</th>
                  <th>Статус</th>
                  <th>Оплата ¥</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="text-muted">{formatDateTime(order.createdAt)}</td>
                    <td>
                      <Link href={`/parcels/${order.id}`} className="link">
                        {order.number}
                      </Link>
                    </td>
                    <td>{dash(order.recipientName)}</td>
                    <td><ParcelStatusBadge status={order.status} /></td>
                    <td className="tabular">{formatCny(order.totalCny)}</td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr><td colSpan={5} className="table-empty">Посылок нет</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); display: inline-flex; align-items: center; gap: 12px; }
        .page-title-name { font-weight: 600; color: var(--color-text-secondary, var(--color-muted)); font-size: 18px; }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-sep { color: var(--color-border-strong); }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card); }
        .card--full { grid-column: 1 / -1; padding: 20px 0; }
        .card-title { font-size: 14px; font-weight: 600; margin: 0 0 16px; color: var(--color-text); padding: 0 20px; }

        .info-list { display: flex; flex-direction: column; gap: 10px; }
        .info-row { display: flex; gap: 12px; font-size: 13px; }
        .info-row dt { width: 100px; flex-shrink: 0; color: var(--color-muted); }
        .info-row dd { flex: 1; color: var(--color-text); margin: 0; }

        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .stat { padding: 16px; background: var(--color-muted-bg); border-radius: var(--radius-sm); }
        .stat-label { font-size: 12px; color: var(--color-muted); margin: 0 0 6px; }
        .stat-value { font-size: 22px; font-weight: 700; color: var(--color-text); margin: 0; font-variant-numeric: tabular-nums; }
        .stat-hint { font-size: 11px; color: var(--color-muted); margin: 4px 0 0; }

        .code-pill { display: inline-flex; align-items: center; min-width: 42px; justify-content: center; padding: 3px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: var(--color-text); background: var(--color-muted-bg); }
        .code-pill--lg { font-size: 18px; padding: 6px 14px; min-width: 60px; }

        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 8px 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 12px 20px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: top; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 32px 16px !important; color: var(--color-muted); }

        .link { color: var(--color-accent); text-decoration: none; font-weight: 500; }
        .link:hover { text-decoration: underline; }
        .tabular { font-variant-numeric: tabular-nums; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .text-muted { color: var(--color-muted); }
        .address-cell { max-width: 320px; min-width: 220px; }

        .btn-ghost { display: inline-flex; align-items: center; padding: 5px 10px; background: transparent; border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; color: var(--color-accent); text-decoration: none; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .btn-ghost:hover { background: oklch(52% 0.14 42 / 0.08); }
        .btn-sm { padding: 4px 8px; }
        .btn-primary { display: inline-flex; align-items: center; justify-content: center; padding: 9px 14px; border: 1px solid var(--color-accent); border-radius: var(--radius-sm); background: var(--color-accent); color: var(--color-accent-fg); font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
        .btn-primary:hover { background: var(--color-accent-hover); border-color: var(--color-accent-hover); }

        @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
