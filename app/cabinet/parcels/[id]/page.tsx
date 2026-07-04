import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Package, Phone, Scale, User } from "lucide-react";
import type { ParcelStatus } from "@prisma/client";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { prisma } from "@/lib/prisma";
import StatusPill, { statusLabel } from "@/components/cabinet/status-pill";
import { formatUsd, formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Посылка" };

const TIMELINE: ParcelStatus[] = [
  "FORMED",
  "ASSEMBLED",
  "PACKED",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
];

export default async function ClientCabinetParcelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { client } = await getClientCabinetContext();
  const codeVariants = Array.from(
    new Set([client.code, client.code.toUpperCase(), client.code.toLowerCase()])
  );

  const parcel = await prisma.parcel.findFirst({
    where: {
      id,
      deletedAt: null,
      customer: {
        OR: [{ clientCode: { in: codeVariants } }, { code: { in: codeVariants } }],
      },
    },
    select: {
      id: true,
      number: true,
      trackingNumber: true,
      status: true,
      totalUsd: true,
      isPaid: true,
      actualWeightKg: true,
      billableWeightKg: true,
      createdAt: true,
      recipient: { select: { name: true, address: true, phone: true } },
      orders: {
        select: {
          id: true,
          productNameText: true,
          customerComment: true,
          quantity: true,
          declaredValueUsd: true,
        },
      },
    },
  });

  if (!parcel) notFound();

  const step = TIMELINE.indexOf(parcel.status);
  const recipient = !!parcel.recipient &&
    [parcel.recipient.name, parcel.recipient.address, parcel.recipient.phone].some(Boolean);
  const weight = parcel.billableWeightKg ?? parcel.actualWeightKg;

  return (
    <div className="pd">
      <Link href="/cabinet/parcels" className="pd-back">
        <ArrowLeft size={18} />
        Все посылки
      </Link>

      <header className="pd-hero">
        <div className="pd-hero-top">
          <span className="pd-hero-icon"><Package size={20} /></span>
          <StatusPill status={parcel.status} />
        </div>
        <span className="pd-hero-label">Посылка</span>
        <h1 className="pd-num">{parcel.number}</h1>
        {parcel.trackingNumber && (
          <span className="pd-track">Трек: {parcel.trackingNumber}</span>
        )}
      </header>

      {step >= 0 && (
        <section className="pd-card">
          <h2 className="pd-card-title">Статус доставки</h2>
          <div className="pd-timeline" aria-hidden="true">
            {TIMELINE.map((s, i) => {
              const reached = i <= step;
              const isLast = i === TIMELINE.length - 1;
              return (
                <div key={s} className="pd-tstep">
                  <span className={`pd-dot ${reached ? "pd-dot--on" : ""}`} />
                  {!isLast && (
                    <span className={`pd-line ${i < step ? "pd-line--on" : ""}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="pd-tlabels">
            {TIMELINE.map((s) => (
              <span key={s}>{statusLabel(s)}</span>
            ))}
          </div>
        </section>
      )}

      <section className="pd-card">
        <h2 className="pd-card-title">Сводка</h2>
        <ul className="pd-facts">
          <li className="pd-fact">
            <span className="pd-fact-label">К оплате</span>
            <span className={`pd-fact-val ${parcel.isPaid ? "pd-fact-val--ok" : "pd-fact-val--due"}`}>
              {formatUsd(parcel.totalUsd)}
            </span>
          </li>
          <li className="pd-fact">
            <span className="pd-fact-label">Оплата</span>
            <span className="pd-fact-val">{parcel.isPaid ? "Оплачено" : "Ожидает"}</span>
          </li>
          {weight != null && (
            <li className="pd-fact">
              <span className="pd-fact-label"><Scale size={13} /> Вес</span>
              <span className="pd-fact-val">{formatNumber(Number(weight))} кг</span>
            </li>
          )}
          <li className="pd-fact">
            <span className="pd-fact-label">Позиций</span>
            <span className="pd-fact-val">{parcel.orders.length}</span>
          </li>
          <li className="pd-fact">
            <span className="pd-fact-label">Создана</span>
            <span className="pd-fact-val">{formatDate(parcel.createdAt)}</span>
          </li>
        </ul>
      </section>

      {recipient && (
        <section className="pd-card">
          <h2 className="pd-card-title">Получатель</h2>
          <ul className="pd-contacts">
            {parcel.recipient?.name && (
              <li className="pd-contact">
                <span className="pd-contact-icon"><User size={15} /></span>
                <span className="pd-contact-val">{parcel.recipient.name}</span>
              </li>
            )}
            {parcel.recipient?.address && (
              <li className="pd-contact">
                <span className="pd-contact-icon"><MapPin size={15} /></span>
                <span className="pd-contact-val">{parcel.recipient.address}</span>
              </li>
            )}
            {parcel.recipient?.phone && (
              <li className="pd-contact">
                <span className="pd-contact-icon"><Phone size={15} /></span>
                <span className="pd-contact-val">{parcel.recipient.phone}</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {parcel.orders.length > 0 && (
        <section className="pd-card">
          <h2 className="pd-card-title">Состав ({parcel.orders.length})</h2>
          <ul className="pd-items">
            {parcel.orders.map((it) => (
              <li key={it.id} className="pd-item">
                <span className="pd-item-main">
                  <span className="pd-item-name">{it.productNameText ?? "Товар"}</span>
                  {it.customerComment?.trim() && (
                    <span className="pd-item-comment">💬 {it.customerComment}</span>
                  )}
                </span>
                <span className="pd-item-meta">
                  <span className="pd-item-qty">× {it.quantity}</span>
                  {it.declaredValueUsd != null && (
                    <span className="pd-item-sum">{formatUsd(it.declaredValueUsd)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <style>{`
        .pd { display: flex; flex-direction: column; gap: 14px; padding-bottom: 8px; }

        .pd-back {
          display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
          padding: 4px 2px; font-size: 13px; font-weight: 600; color: var(--cab-green-deep);
          text-decoration: none;
        }

        .pd-hero {
          display: flex; flex-direction: column; gap: 6px; padding: 18px 16px;
          border-radius: var(--cab-radius-lg);
          background:
            radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--cab-green) 16%, transparent) 0%, transparent 58%),
            var(--cab-surface);
          border: 1px solid color-mix(in srgb, var(--cab-green) 18%, var(--cab-border));
          box-shadow: var(--cab-shadow-sm);
        }
        .pd-hero-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .pd-hero-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 12px; color: #fff;
          background: linear-gradient(150deg, var(--cab-green), var(--cab-green-deep));
          box-shadow: 0 8px 18px color-mix(in srgb, var(--cab-green) 40%, transparent);
        }
        .pd-hero-label { font-size: 12px; font-weight: 600; color: var(--cab-muted); }
        .pd-num { margin: 0; font-family: var(--font-jetbrains-mono), monospace; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
        .pd-track { font-family: var(--font-jetbrains-mono), monospace; font-size: 12px; color: var(--cab-text-soft); }

        .pd-card {
          display: flex; flex-direction: column; gap: 12px; padding: 16px;
          border-radius: var(--cab-radius-md); background: var(--cab-surface);
          border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm);
        }
        .pd-card-title { margin: 0; font-size: 14px; font-weight: 700; }

        .pd-timeline { display: flex; align-items: center; margin-top: 2px; }
        .pd-tstep { display: flex; align-items: center; flex: 1; }
        .pd-tstep:last-child { flex: 0; }
        .pd-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--cab-border-strong); flex-shrink: 0; transition: background 0.2s; }
        .pd-dot--on { background: var(--cab-green); box-shadow: 0 0 0 4px color-mix(in srgb, var(--cab-green) 16%, transparent); }
        .pd-line { flex: 1; height: 3px; margin: 0 4px; border-radius: 2px; background: var(--cab-border-strong); }
        .pd-line--on { background: var(--cab-green); }
        .pd-tlabels { display: flex; justify-content: space-between; margin-top: 5px; }
        .pd-tlabels span { font-size: 9.5px; line-height: 1.2; color: var(--cab-muted); flex: 1; text-align: left; padding-right: 4px; word-break: break-word; }
        .pd-tlabels span:last-child { flex: 0 0 auto; text-align: right; padding-right: 0; white-space: nowrap; }

        .pd-facts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
        .pd-fact { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--cab-border); }
        .pd-fact:last-child { border-bottom: none; }
        .pd-fact-label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--cab-muted); }
        .pd-fact-val { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .pd-fact-val--ok { color: var(--cab-green-deep); }
        .pd-fact-val--due { color: var(--cab-amber); }

        .pd-contacts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .pd-contact { display: flex; align-items: flex-start; gap: 12px; }
        .pd-contact-icon {
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 32px; height: 32px; border-radius: 10px; color: var(--cab-green-deep);
          background: color-mix(in srgb, var(--cab-green) 12%, transparent);
        }
        .pd-contact-val { font-size: 13.5px; font-weight: 500; line-height: 1.45; word-break: break-word; padding-top: 6px; }

        .pd-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .pd-item {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 12px 14px; border-radius: var(--cab-radius-sm);
          background: color-mix(in srgb, var(--cab-bg) 60%, var(--cab-surface));
          border: 1px solid var(--cab-border);
        }
        .pd-item-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .pd-item-name { font-size: 13.5px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .pd-item-comment { font-size: 11.5px; color: var(--cab-text-soft); line-height: 1.35; word-break: break-word; }
        .pd-item-meta { display: inline-flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .pd-item-qty { font-size: 12.5px; color: var(--cab-muted); font-variant-numeric: tabular-nums; }
        .pd-item-sum { font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; }

      `}</style>
    </div>
  );
}
