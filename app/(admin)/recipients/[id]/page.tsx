import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { cleanAddressLine } from "@/lib/customer-label";
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
  });

  if (!customer) notFound();

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

      <div className="card">
        <h2 className="card-title">Контактные данные</h2>
        <dl className="info-list">
          <div className="info-row"><dt>КОД_КЛИЕНТА</dt><dd>{dash(customer.clientCode ?? customer.code)}</dd></div>
          <div className="info-row"><dt>Дата внесения</dt><dd>{formatInformationDate(customer.informationDate, customer.informationDateText)}</dd></div>
        </dl>

        <hr className="info-divider" />

        <dl className="info-list">
          <div className="info-row"><dt>Фамилия</dt><dd>{dash(customer.lastName)}</dd></div>
          <div className="info-row"><dt>Имя</dt><dd>{dash(customer.firstName)}</dd></div>
          <div className="info-row"><dt>Отчество</dt><dd>{dash(customer.middleName)}</dd></div>
          <div className="info-row"><dt>Email</dt><dd>{customer.email ?? "—"}</dd></div>
          <div className="info-row"><dt>Telegram</dt><dd>{customer.username ?? "—"}</dd></div>
          <div className="info-row"><dt>Телефон</dt><dd>{customer.phone ?? "—"}</dd></div>
        </dl>

        <hr className="info-divider info-divider--soft" />

        <dl className="info-list info-list--address">
          <div className="info-row"><dt>Страна</dt><dd>{customer.country ?? "—"}</dd></div>
          <div className="info-row"><dt>Код страны</dt><dd>{customer.countryCode ?? "—"}</dd></div>
          <div className="info-row"><dt>Населённый пункт</dt><dd>{customer.city ?? "—"}</dd></div>
          <div className="info-row"><dt>Почтовый код</dt><dd>{customer.postalCode ?? "—"}</dd></div>
          <div className="info-row"><dt>Улица, дом, квартира</dt><dd>{dash(cleanAddressLine(customer.address, [customer.country, customer.countryCode, customer.city, customer.postalCode]))}</dd></div>
        </dl>
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

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card); }
        .card-title { font-size: 14px; font-weight: 600; margin: 0 0 16px; color: var(--color-text); }

        .info-list { display: flex; flex-direction: column; gap: 10px; margin: 0; }
        .info-list--address { gap: 16px; margin-top: 8px; }
        .info-row { display: flex; gap: 12px; font-size: 13px; }
        .info-row dt { width: 180px; flex-shrink: 0; color: var(--color-muted); }
        .info-row dd { flex: 1; color: var(--color-text); margin: 0; }
        .info-divider { border: 0; border-top: 1px solid var(--color-border); margin: 16px 0; }
        .info-divider--soft { border-top-style: dashed; border-top-color: color-mix(in srgb, var(--color-border) 60%, transparent); margin: 12px 0; }
      `}</style>
    </div>
  );
}
