import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCny, formatDateTime, formatUsd } from "@/lib/utils";
import { cleanAddressLine } from "@/lib/customer-label";
import { ParcelStatusBadge } from "@/components/ui/status-badge";
import { updateParcelStatus, deleteParcel } from "@/actions/parcels";
import ParcelActions from "./parcel-actions";

export const metadata: Metadata = { title: "Посылка" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const order = await prisma.parcel.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true,
      items: {
        orderBy: [{ id: "asc" }],
        include: {
          order: {
            include: {
              trackItems: {
                select: { trackNumber: true, name: true, quantity: true, unitPrice: true, totalPrice: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!order) notFound();

  const isAdmin = session?.user.role === "ADMIN";
  const totalUsd = Number(order.totalUsd || order.total || 0);
  const totalCny = Number(order.totalCny || 0);
  const exchangeRateCnyPerUsd = Number(order.exchangeRateCnyPerUsd || 7.1);
  const localDeliveryCny = Number(order.localDeliveryCny ?? 0);
  const discountPercent = Number(order.discountCny ?? 0);
  const customer = order.customer;
  const street = cleanAddressLine(customer.address, [
    customer.country,
    customer.countryCode,
    customer.city,
    customer.postalCode,
  ]);
  const weight = order.actualWeightKg ?? order.weightKg;

  type CompositionRow = {
    key: string;
    orderId: string;
    trackNumber: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotalUsd: number;
  };

  const compositionRows: CompositionRow[] = order.items.flatMap((item) => {
    const tracks = item.order.trackItems;
    const snapshotName = item.name?.trim();

    if (snapshotName) {
      const unitPrice = Number(item.price);
      const lineTotalUsd = Number(item.lineTotalUsd ?? unitPrice * item.quantity);
      return [
        {
          key: item.id,
          orderId: item.order.id,
          trackNumber: tracks[0]?.trackNumber ?? null,
          name: snapshotName,
          quantity: item.quantity,
          unitPrice,
          lineTotalUsd,
        },
      ];
    }

    if (tracks.length === 0) {
      const unitPrice = Number(item.price);
      const lineTotalUsd = Number(item.lineTotalUsd ?? unitPrice * item.quantity);
      return [
        {
          key: item.id,
          orderId: item.order.id,
          trackNumber: null,
          name: "—",
          quantity: item.quantity,
          unitPrice,
          lineTotalUsd,
        },
      ];
    }

    return tracks.map((t, idx) => {
      const unitPrice = Number(t.unitPrice);
      const lineTotalUsd = Number(t.totalPrice ?? unitPrice * t.quantity);
      return {
        key: `${item.id}-${idx}`,
        orderId: item.order.id,
        trackNumber: t.trackNumber || null,
        name: t.name?.trim() || "—",
        quantity: t.quantity,
        unitPrice,
        lineTotalUsd,
      };
    });
  });

  const itemsTotalUsd = compositionRows.reduce((sum, row) => sum + row.lineTotalUsd, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/parcels" className="breadcrumb-link">Посылки</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{order.number}</span>
          </div>
          <h1 className="page-title">{order.number}</h1>
          <ParcelStatusBadge status={order.status} className="page-status" />
        </div>

        <ParcelActions
          orderId={order.id}
          currentStatus={order.status}
          isAdmin={isAdmin}
          updateStatus={updateParcelStatus}
          deleteParcelAction={deleteParcel}
        />
      </div>

      <div className="order-grid">
        <div className="card">
          <h2 className="card-title">Получатель</h2>
          <dl className="info-list">
            <div className="info-row">
              <dt>Имя</dt>
              <dd>
                <Link href={`/recipients/${customer.id}`} className="link">
                  {customer.name}
                </Link>
              </dd>
            </div>
            {customer.email && (
              <div className="info-row">
                <dt>Email</dt>
                <dd>{customer.email}</dd>
              </div>
            )}
            {customer.phone && (
              <div className="info-row">
                <dt>Телефон</dt>
                <dd>{customer.phone}</dd>
              </div>
            )}
            {customer.country && (
              <div className="info-row">
                <dt>Страна</dt>
                <dd>{customer.country}</dd>
              </div>
            )}
            {customer.city && (
              <div className="info-row">
                <dt>Город</dt>
                <dd>{customer.city}</dd>
              </div>
            )}
            {customer.postalCode && (
              <div className="info-row">
                <dt>Индекс</dt>
                <dd>{customer.postalCode}</dd>
              </div>
            )}
            {street && (
              <div className="info-row">
                <dt>Улица, дом, квартира</dt>
                <dd>{street}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card">
          <h2 className="card-title">Детали посылки</h2>
          <dl className="info-list">
            <div className="info-row">
              <dt>Номер</dt>
              <dd className="mono">{order.number}</dd>
            </div>
            <div className="info-row">
              <dt>Создано</dt>
              <dd>{formatDateTime(order.createdAt)}</dd>
            </div>
            <div className="info-row">
              <dt>Посылка</dt>
              <dd className="mono">
                {order.parcelNumberLooksValid ? order.parcelNumber : "Номер не указан"}
              </dd>
            </div>
            {weight && (
              <div className="info-row">
                <dt>Вес</dt>
                <dd>{Number(weight).toFixed(2)} кг</dd>
              </div>
            )}
            {order.notes && (
              <div className="info-row">
                <dt>Заметки</dt>
                <dd>{order.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card card--full">
          <h2 className="card-title">Расчёт и оплата</h2>
          <dl className="money-details">
            <div className="info-row">
              <dt>Сумма в USD</dt>
              <dd className="tabular">{formatUsd(totalUsd)}</dd>
            </div>
            <div className="info-row">
              <dt>Курс CNY / USD</dt>
              <dd className="tabular">{exchangeRateCnyPerUsd.toLocaleString("ru-RU", { maximumFractionDigits: 4 })}</dd>
            </div>
            {localDeliveryCny > 0 && (
              <div className="info-row">
                <dt>Локальная доставка</dt>
                <dd className="tabular">{formatCny(localDeliveryCny)}</dd>
              </div>
            )}
            {discountPercent > 0 && (
              <div className="info-row">
                <dt>Скидка</dt>
                <dd className="tabular">{discountPercent.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} %</dd>
              </div>
            )}
            <div className="info-row info-row--accent">
              <dt>К оплате</dt>
              <dd className="tabular">{formatCny(totalCny)}</dd>
            </div>
            <div className="info-row">
              <dt>Оплата</dt>
              <dd>{order.isPaid ? "Оплачен" : "Не оплачен"}</dd>
            </div>
          </dl>
        </div>

        <div className="card card--full">
          <h2 className="card-title">Состав посылки</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}>№</th>
                  <th>Трек номер</th>
                  <th>Наименование</th>
                  <th style={{ textAlign: "right" }}>Стоимость за единицу $</th>
                  <th style={{ textAlign: "right" }}>Кол-во</th>
                  <th style={{ textAlign: "right" }}>Итого $</th>
                </tr>
              </thead>
              <tbody>
                {compositionRows.map((row, idx) => (
                  <tr key={row.key}>
                    <td className="row-index">{idx + 1}</td>
                    <td className="mono">
                      {row.trackNumber ? (
                        <Link href={`/orders/${row.orderId}/edit`} className="link">
                          {row.trackNumber}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>{row.name}</td>
                    <td className="tabular" style={{ textAlign: "right" }}>{formatUsd(row.unitPrice)}</td>
                    <td className="tabular" style={{ textAlign: "right" }}>{row.quantity}</td>
                    <td className="tabular" style={{ textAlign: "right", fontWeight: 500 }}>
                      {formatUsd(row.lineTotalUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: "right", fontWeight: 600, paddingRight: 16 }}>
                    Итого:
                  </td>
                  <td className="tabular" style={{ textAlign: "right", fontWeight: 700, fontSize: 16 }}>
                    {formatUsd(itemsTotalUsd)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-link:hover { text-decoration: underline; }
        .breadcrumb-sep { color: var(--color-border-strong); }

        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-status { margin-top: 8px; }

        .order-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .card {
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 20px;
          box-shadow: var(--shadow-card);
        }

        .card--full { grid-column: 1 / -1; }
        .card-title { font-size: 14px; font-weight: 600; margin: 0 0 16px; color: var(--color-text); }

        .info-list { display: flex; flex-direction: column; gap: 10px; }
        .money-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; margin: 16px 0 0; }
        .info-row { display: flex; gap: 12px; font-size: 13px; }
        .info-row dt { width: 140px; flex-shrink: 0; color: var(--color-muted); }
        .info-row dd { flex: 1; color: var(--color-text); margin: 0; }
        .info-row--accent dt { color: var(--color-success); font-weight: 600; }
        .info-row--accent dd { color: var(--color-success); font-weight: 700; font-size: 15px; }
        .muted-note { font-size: 12.5px; color: var(--color-muted); margin: 0; }

        .link { color: var(--color-accent); text-decoration: none; }
        .link:hover { text-decoration: underline; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }

        .table-wrap { overflow-x: auto; margin: 0 -20px; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th {
          text-align: left; padding: 8px 20px;
          font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
          color: var(--color-muted); border-bottom: 1px solid var(--color-border);
        }
        .table td { padding: 12px 20px; border-bottom: 1px solid var(--color-border); color: var(--color-text); }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tfoot td { padding: 12px 20px; border-top: 2px solid var(--color-border); }
        .row-index { text-align: center; color: var(--color-muted); font-variant-numeric: tabular-nums; width: 40px; }

        @media (max-width: 768px) {
          .order-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
