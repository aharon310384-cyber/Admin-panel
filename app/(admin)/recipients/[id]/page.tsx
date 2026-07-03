import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/utils";
import { deleteRecipient } from "@/actions/recipients";
import DeleteRecipientButton from "./delete-recipient-button";

export const metadata: Metadata = { title: "Карточка получателя" };

function dash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

export default async function RecipientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const recipient = await prisma.recipient.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true, code: true } },
      author: { select: { name: true } },
    },
  });

  if (!recipient) notFound();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/recipients" className="breadcrumb-link">Получатели</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{recipient.name}</span>
          </div>
          <h1 className="page-title">{recipient.name}</h1>
        </div>
        {isAdmin && (
          <div className="header-actions">
            <Link href={`/recipients/${recipient.id}/edit`} className="btn-secondary">
              Редактировать
            </Link>
            <DeleteRecipientButton recipientId={recipient.id} deleteAction={deleteRecipient} />
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Клиент-владелец</h2>
        <dl className="info-list">
          <div className="info-row">
            <dt>Клиент</dt>
            <dd>
              <Link href={`/clients/${recipient.customer.id}`} className="link">
                {recipient.customer.code ? (
                  <span className="code-pill">{recipient.customer.code}</span>
                ) : null}{" "}
                {recipient.customer.name}
              </Link>
            </dd>
          </div>
        </dl>

        <hr className="info-divider" />

        <h2 className="card-title">Данные получателя</h2>
        <dl className="info-list">
          <div className="info-row"><dt>Фамилия</dt><dd>{dash(recipient.lastName)}</dd></div>
          <div className="info-row"><dt>Имя</dt><dd>{dash(recipient.firstName)}</dd></div>
          <div className="info-row"><dt>Отчество</dt><dd>{dash(recipient.middleName)}</dd></div>
        </dl>

        <hr className="info-divider info-divider--soft" />

        <dl className="info-list info-list--address">
          <div className="info-row"><dt>Страна</dt><dd>{dash(recipient.country)}{recipient.countryCode ? ` (${recipient.countryCode})` : ""}</dd></div>
          <div className="info-row"><dt>Населённый пункт</dt><dd>{dash(recipient.city)}</dd></div>
          <div className="info-row"><dt>Почтовый индекс</dt><dd>{dash(recipient.postalCode)}</dd></div>
          <div className="info-row"><dt>Улица, дом, квартира</dt><dd>{dash(recipient.address)}</dd></div>
          <div className="info-row"><dt>Телефон</dt><dd>{dash([recipient.phoneDialCode, recipient.phone].filter(Boolean).join(" ") || null)}</dd></div>
        </dl>

        <hr className="info-divider" />

        <h2 className="card-title">Документы</h2>
        <dl className="info-list">
          <div className="info-row"><dt>Серия паспорта</dt><dd>{dash(recipient.passportSeries)}</dd></div>
          <div className="info-row"><dt>Номер паспорта</dt><dd>{dash(recipient.passportNumber)}</dd></div>
          <div className="info-row"><dt>Дата окончания</dt><dd>{recipient.passportExpiry ? formatDate(recipient.passportExpiry) : "—"}</dd></div>
          <div className="info-row"><dt>PINFL</dt><dd className="mono">{dash(recipient.pinfl)}</dd></div>
        </dl>

        <hr className="info-divider info-divider--soft" />

        <dl className="info-list">
          <div className="info-row"><dt>Автор</dt><dd>{dash(recipient.author?.name)}</dd></div>
          <div className="info-row"><dt>Создан</dt><dd>{formatDateTime(recipient.createdAt)}</dd></div>
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
        .link { color: var(--color-accent); text-decoration: none; }
        .link:hover { text-decoration: underline; }
        .code-pill { display: inline-flex; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); }
        .mono { font-family: var(--font-mono); }
      `}</style>
    </div>
  );
}
