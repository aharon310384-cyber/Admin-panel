import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Radar,
  ReceiptText,
  User,
} from "lucide-react";
import type { ParcelStatus } from "@prisma/client";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { getFinanceSettings } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { deliveryTypeLabel } from "@/lib/statuses";
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

const cny = (n: number) => `¥${n.toFixed(2)}`;

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
      deliveryType: true,
      totalUsd: true,
      totalCny: true,
      isPaid: true,
      actualWeightKg: true,
      billableWeightKg: true,
      shippingCostUsd: true,
      discountPercent: true,
      exchangeRateCnyPerUsd: true,
      customsDutyEur: true,
      customsDutyUsd: true,
      customsDutyLineCount: true,
      customsDutyPassToClient: true,
      createdAt: true,
      recipient: { select: { name: true, address: true, phone: true } },
      services: {
        select: { id: true, name: true, priceUsd: true, priceCny: true },
        orderBy: { id: "asc" },
      },
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

  const finance = await getFinanceSettings();
  const step = TIMELINE.indexOf(parcel.status);
  const hasRecipient = !!parcel.recipient &&
    [parcel.recipient.name, parcel.recipient.address, parcel.recipient.phone].some(Boolean);

  const rate = Number(parcel.exchangeRateCnyPerUsd);
  const shipping = Number(parcel.shippingCostUsd ?? 0);
  const discountPercent = parcel.discountPercent != null ? Number(parcel.discountPercent) : 0;
  const actualWeight = parcel.actualWeightKg != null ? Number(parcel.actualWeightKg) : null;
  const billableWeight = parcel.billableWeightKg != null ? Number(parcel.billableWeightKg) : null;

  // Пошлина ЕС — только сохранённые значения (что реально выставлено в счёт)
  const dutyUsd = parcel.customsDutyUsd != null ? Number(parcel.customsDutyUsd) : 0;
  const dutyEur = parcel.customsDutyEur != null ? Number(parcel.customsDutyEur) : 0;
  const dutyLines = parcel.customsDutyLineCount ?? 0;
  const dutyPassToClient = parcel.customsDutyPassToClient ?? finance.euDutyPassToClient;
  const showDutyRow = dutyUsd > 0 && dutyPassToClient;
  const dutyPaidBySender = dutyUsd > 0 && !dutyPassToClient;

  const trackUrl = parcel.trackingNumber
    ? `https://t.17track.net/en#nums=${encodeURIComponent(parcel.trackingNumber)}`
    : null;

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
        <div className="pd-hero-meta">
          <span className="pd-chip">{deliveryTypeLabel(parcel.deliveryType)}</span>
          <span className="pd-hero-date">создана {formatDate(parcel.createdAt)}</span>
        </div>
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
        <h2 className="pd-card-title">
          <ReceiptText size={15} className="pd-title-icon" />
          Квитанция
        </h2>
        <table className="pd-rcpt">
          <tbody>
            <tr>
              <td>Отправка</td>
              <td className="pd-r">{formatUsd(shipping)}</td>
              <td className="pd-r pd-cny">{cny(shipping * rate)}</td>
            </tr>
            {parcel.services.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="pd-r">{formatUsd(Number(s.priceUsd))}</td>
                <td className="pd-r pd-cny">{cny(Number(s.priceCny))}</td>
              </tr>
            ))}
            {discountPercent > 0 && (
              <tr className="pd-disc">
                <td>Скидка {formatNumber(discountPercent)}%</td>
                <td className="pd-r" colSpan={2}>−</td>
              </tr>
            )}
            {showDutyRow && (
              <tr>
                <td>Таможенная пошлина ЕС (€3 × {dutyLines} = €{dutyEur.toFixed(2)})</td>
                <td className="pd-r">{formatUsd(dutyUsd)}</td>
                <td className="pd-r pd-cny">{cny(Math.round(dutyUsd * rate * 100) / 100)}</td>
              </tr>
            )}
            <tr className="pd-total">
              <td>ИТОГО</td>
              <td className="pd-r">{formatUsd(Number(parcel.totalUsd))}</td>
              <td className="pd-r">{cny(Number(parcel.totalCny))}</td>
            </tr>
          </tbody>
        </table>
        <p className="pd-rcpt-note">Курс: {formatNumber(rate)} ¥/$</p>
        {dutyPaidBySender && (
          <p className="pd-rcpt-note">
            Таможенная пошлина ЕС €{dutyEur.toFixed(2)} оплачивается отправителем — в счёт не входит.
          </p>
        )}
        <div className={`pd-pay ${parcel.isPaid ? "pd-pay--ok" : "pd-pay--due"}`}>
          {parcel.isPaid ? "Оплачено" : "Ожидает оплаты"}
        </div>
      </section>

      <section className="pd-card">
        <h2 className="pd-card-title">Сводка</h2>
        <ul className="pd-facts">
          {actualWeight != null && (
            <li className="pd-fact">
              <span className="pd-fact-label">Фактический вес</span>
              <span className="pd-fact-val">{formatNumber(actualWeight)} кг</span>
            </li>
          )}
          {billableWeight != null && (
            <li className="pd-fact">
              <span className="pd-fact-label">Расчётный вес</span>
              <span className="pd-fact-val">{formatNumber(billableWeight)} кг</span>
            </li>
          )}
          <li className="pd-fact">
            <span className="pd-fact-label">Тип доставки</span>
            <span className="pd-fact-val">{deliveryTypeLabel(parcel.deliveryType)}</span>
          </li>
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

      <section className="pd-card">
        <h2 className="pd-card-title">
          <Radar size={15} className="pd-title-icon" />
          Отслеживание
        </h2>
        {trackUrl ? (
          <a className="pd-track" href={trackUrl} target="_blank" rel="noopener noreferrer">
            <span className="pd-track-num">{parcel.trackingNumber}</span>
            <span className="pd-track-go">
              17track <ExternalLink size={13} />
            </span>
          </a>
        ) : (
          <p className="pd-track-none">Трек-номер пока не присвоен</p>
        )}
      </section>

      {hasRecipient && (
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
                    <span className="pd-item-comment">
                      <MessageSquare size={12} className="pd-item-comment-icon" />
                      {it.customerComment}
                    </span>
                  )}
                </span>
                <span className="pd-item-meta">
                  <span className="pd-item-qty">× {it.quantity}</span>
                  {it.declaredValueUsd != null && (
                    <span className="pd-item-sum">{formatUsd(Number(it.declaredValueUsd))}</span>
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
        .pd-hero-meta { display: flex; align-items: center; gap: 10px; margin-top: 4px; flex-wrap: wrap; }
        .pd-chip {
          display: inline-flex; align-items: center; padding: 4px 11px; border-radius: 999px;
          font-size: 12px; font-weight: 600; color: var(--cab-green-deep);
          background: color-mix(in srgb, var(--cab-green) 13%, transparent);
          border: 1px solid color-mix(in srgb, var(--cab-green) 24%, transparent);
        }
        .pd-hero-date { font-size: 12px; color: var(--cab-muted); }

        .pd-card {
          display: flex; flex-direction: column; gap: 12px; padding: 16px;
          border-radius: var(--cab-radius-md); background: var(--cab-surface);
          border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm);
        }
        .pd-card-title { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 14px; font-weight: 700; }
        .pd-title-icon { color: var(--cab-green-deep); }

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

        .pd-rcpt { width: 100%; border-collapse: collapse; font-size: 13px; }
        .pd-rcpt td { padding: 10px 4px; border-bottom: 1px dashed var(--cab-border-strong); vertical-align: top; }
        .pd-r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 600; }
        .pd-cny { color: var(--cab-muted); font-weight: 500; font-size: 12px; }
        .pd-disc td { color: var(--cab-orange); }
        .pd-total td {
          font-weight: 700; font-size: 15px; border-bottom: none;
          border-top: 2px solid color-mix(in srgb, var(--cab-green) 30%, var(--cab-border-strong));
          padding-top: 13px; color: var(--cab-text);
        }
        .pd-total .pd-r { color: var(--cab-green-deep); }
        .pd-rcpt-note { margin: 0; font-size: 11.5px; color: var(--cab-muted); line-height: 1.45; }
        .pd-pay {
          align-self: flex-start; display: inline-flex; align-items: center;
          padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 700;
        }
        .pd-pay--ok { color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-green) 14%, transparent); }
        .pd-pay--due { color: #8a5a00; background: color-mix(in srgb, var(--cab-amber) 18%, transparent); }

        .pd-facts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
        .pd-fact { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--cab-border); }
        .pd-fact:last-child { border-bottom: none; padding-bottom: 0; }
        .pd-fact:first-child { padding-top: 0; }
        .pd-fact-label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--cab-muted); }
        .pd-fact-val { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }

        .pd-track {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 13px 14px; border-radius: var(--cab-radius-sm); text-decoration: none;
          background: color-mix(in srgb, var(--cab-bg) 60%, var(--cab-surface));
          border: 1px solid var(--cab-border); color: var(--cab-text);
          transition: border-color 0.15s ease;
        }
        .pd-track:hover { border-color: color-mix(in srgb, var(--cab-green) 40%, var(--cab-border)); }
        .pd-track-num { font-family: var(--font-jetbrains-mono), monospace; font-size: 14px; font-weight: 600; word-break: break-all; }
        .pd-track-go {
          display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
          font-size: 12.5px; font-weight: 700; color: var(--cab-green-deep);
        }
        .pd-track-none { margin: 0; font-size: 13px; color: var(--cab-muted); }

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
        .pd-item-comment { display: inline-flex; align-items: flex-start; gap: 5px; font-size: 11.5px; color: var(--cab-text-soft); line-height: 1.35; word-break: break-word; }
        .pd-item-comment-icon { flex-shrink: 0; margin-top: 1px; color: var(--cab-muted); }
        .pd-item-meta { display: inline-flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .pd-item-qty { font-size: 12.5px; color: var(--cab-muted); font-variant-numeric: tabular-nums; }
        .pd-item-sum { font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; }

        @media (min-width: 1024px) {
          .pd { max-width: 720px; }
          .pd-hero { padding: 22px 24px; }
          .pd-num { font-size: 26px; }
          .pd-card { padding: 20px; }
        }
      `}</style>
    </div>
  );
}
