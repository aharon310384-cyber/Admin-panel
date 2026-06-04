import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCny, formatDateTime } from "@/lib/utils";
import { ParcelStatusBadge } from "@/components/ui/status-badge";
import { deleteCustomer } from "@/actions/customers";
import DeleteCustomerButton from "./delete-customer-button";

export const metadata: Metadata = { title: "Карточка получателя" };

function dash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function formatInformationDate(date: Date | null, text: string | null): string {
  if (date) {
    return formatDateTime(date);
  }

  return dash(text);
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      parcels: {
        where: { deletedAt: null },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) notFound();

  const totalSpent = customer.parcels
    .filter((o) => o.status !== "CANCELED")
    .reduce((sum, o) => sum + Number(o.totalCny), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/recipients" className="breadcrumb-link">Получатели</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{customer.name}</span>
          </div>
          <h1 className="page-title">{customer.name}</h1>
        </div>
        {isAdmin && (
          <div className="header-actions">
            <Link href={`/recipients/${customer.id}/edit`} className="btn-secondary">
              Редактировать
            </Link>
            <DeleteCustomerButton customerId={customer.id} deleteAction={deleteCustomer} />
          </div>
        )}
      </div>

      <div className="customer-grid">
        <div className="card">
          <h2 className="card-title">Контактные данные</h2>
          <dl className="info-list">
            <div className="info-row"><dt>КОД_КЛИЕНТА</dt><dd>{dash(customer.clientCode ?? customer.code)}</dd></div>
            <div className="info-row"><dt>Фамилия</dt><dd>{dash(customer.lastName)}</dd></div>
            <div className="info-row"><dt>Имя</dt><dd>{dash(customer.firstName)}</dd></div>
            <div className="info-row"><dt>Отчество</dt><dd>{dash(customer.middleName)}</dd></div>
            <div className="info-row"><dt>Email</dt><dd>{customer.email ?? "—"}</dd></div>
            <div className="info-row"><dt>Telegram</dt><dd>{customer.username ?? "—"}</dd></div>
            <div className="info-row"><dt>Телефон</dt><dd>{customer.phone ?? "—"}</dd></div>
            <div className="info-row"><dt>Страна</dt><dd>{customer.country ?? "—"}</dd></div>
            <div className="info-row"><dt>Код страны</dt><dd>{customer.countryCode ?? "—"}</dd></div>
            <div className="info-row"><dt>Населенный пункт</dt><dd>{customer.city ?? "—"}</dd></div>
            <div className="info-row"><dt>Почтовый код</dt><dd>{customer.postalCode ?? "—"}</dd></div>
            <div className="info-row"><dt>Адрес</dt><dd>{customer.address ?? "—"}</dd></div>
            <div className="info-row"><dt>Дата внесения</dt><dd>{formatInformationDate(customer.informationDate, customer.informationDateText)}</dd></div>
          </dl>
        </div>

        <div className="card">
          <h2 className="card-title">Статистика</h2>
          <div className="stats-grid">
            <div className="stat">
              <p className="stat-label">Всего посылок</p>
              <p className="stat-value">{customer.parcels.length}</p>
            </div>
            <div className="stat">
              <p className="stat-label">Сумма оплат</p>
              <p className="stat-value">{formatCny(totalSpent)}</p>
            </div>
          </div>
        </div>

        <div className="card card--full">
          <h2 className="card-title">История посылок</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Статус</th>
                  <th>Позиций</th>
                  <th>Оплата ¥</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {customer.parcels.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/parcels/${order.id}`} className="link">
                        {order.number}
                      </Link>
                    </td>
                    <td>
                      <ParcelStatusBadge status={order.status} />
                    </td>
                    <td className="tabular">{order.items.length}</td>
                    <td className="tabular">{formatCny(order.totalCny)}</td>
                    <td className="text-muted">{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
                {customer.parcels.length === 0 && (
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
        .header-actions { display: flex; align-items: center; gap: 8px; }
        .btn-secondary { display: inline-flex; align-items: center; padding: 9px 16px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-text); text-decoration: none; transition: background 0.15s; white-space: nowrap; }
        .btn-secondary:hover { background: var(--color-muted-bg); }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-sep { color: var(--color-border-strong); }

        .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card); }
        .card--full { grid-column: 1 / -1; padding: 20px 0; }
        .card-title { font-size: 14px; font-weight: 600; margin: 0 0 16px; color: var(--color-text); padding: 0 20px; }
        .card--full .card-title { padding: 0 20px; }

        .info-list { display: flex; flex-direction: column; gap: 10px; }
        .info-row { display: flex; gap: 12px; font-size: 13px; }
        .info-row dt { width: 100px; flex-shrink: 0; color: var(--color-muted); }
        .info-row dd { flex: 1; color: var(--color-text); margin: 0; }

        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .stat { padding: 16px; background: var(--color-muted-bg); border-radius: var(--radius-sm); }
        .stat-label { font-size: 12px; color: var(--color-muted); margin: 0 0 6px; }
        .stat-value { font-size: 22px; font-weight: 700; color: var(--color-text); margin: 0; font-variant-numeric: tabular-nums; }

        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 8px 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); }
        .table td { padding: 12px 20px; border-bottom: 1px solid var(--color-border); color: var(--color-text); }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 32px 16px !important; color: var(--color-muted); }

        .link { color: var(--color-accent); text-decoration: none; font-weight: 500; }
        .link:hover { text-decoration: underline; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }

        @media (max-width: 768px) { .customer-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
