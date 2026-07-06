import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getFinanceSettings } from "@/lib/finance";
import { formatUsd, formatNumber, formatDateTime } from "@/lib/utils";
import { parcelStatusLabel, orderStatusLabel, deliveryTypeLabel, PARCEL_STATUS_COLOR } from "@/lib/statuses";
import ParcelControls from "@/components/parcels/parcel-controls";

export const metadata: Metadata = { title: "Посылка" };

function has(services: { serviceCode: string }[], code: string): boolean {
  return services.some((s) => s.serviceCode === code);
}
function amount(services: { serviceCode: string; priceUsd: unknown }[], code: string): string {
  const s = services.find((x) => x.serviceCode === code);
  return s ? String(Number(s.priceUsd)) : "";
}
function dash(v: string | null | undefined): string {
  return v?.trim() || "—";
}

export default async function ParcelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parcel = await prisma.parcel.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true,
      recipient: true,
      orders: { orderBy: { createdAt: "asc" } },
      services: { orderBy: { id: "asc" } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!parcel) notFound();

  const rate = Number(parcel.exchangeRateCnyPerUsd);
  const shipping = Number(parcel.shippingCostUsd ?? 0);

  // Тариф (по типу доставки) — для делителя объёмного веса
  const tariff = parcel.deliveryType
    ? await prisma.shippingTariff.findFirst({ where: { deliveryType: parcel.deliveryType, active: true } })
    : null;
  const volumetricDivisor = tariff?.volumetricDivisor ?? 6000;
  const actual = Number(parcel.actualWeightKg ?? 0);
  const volumetric = Number(parcel.volumetricWeightKg ?? 0);
  const billable = Number(parcel.billableWeightKg ?? 0);
  const dims = [parcel.lengthCm, parcel.widthCm, parcel.heightCm].map((d) => (d != null ? Number(d) : 0));
  const hasDims = dims.every((d) => d > 0);

  // Таможенная пошлина ЕС: в счёт включается только при euDutyPassToClient
  const { euDutyPassToClient } = await getFinanceSettings();
  const dutyUsd = parcel.customsDutyUsd != null ? Number(parcel.customsDutyUsd) : 0;
  const dutyEur = parcel.customsDutyEur != null ? Number(parcel.customsDutyEur) : 0;
  const dutyLines = parcel.customsDutyLineCount ?? 0;
  const hasDuty = dutyUsd > 0;

  // Даты отправки/доставки — из истории статусов
  const shippedAt = parcel.statusHistory.find((h) => h.status === "SHIPPED")?.createdAt ?? null;
  const deliveredAt = parcel.statusHistory.find((h) => h.status === "DELIVERED")?.createdAt ?? null;
  const trackUrl = parcel.trackingNumber
    ? `https://t.17track.net/en#nums=${encodeURIComponent(parcel.trackingNumber)}`
    : null;
  const tone = PARCEL_STATUS_COLOR[parcel.status];

  const rcpt = parcel.recipient;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/parcels" className="breadcrumb-link">Посылки</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{parcel.number}</span>
          </div>
          <div className="title-row">
            <h1 className="page-title mono">{parcel.number}</h1>
            <span className={`badge badge--${tone}`}>{parcelStatusLabel(parcel.status)}</span>
            {parcel.isPaid && <span className="badge badge--paid">Оплачено</span>}
          </div>
          <p className="subline">
            {deliveryTypeLabel(parcel.deliveryType)} · расчётный вес {formatNumber(billable)} кг · создана {formatDateTime(parcel.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid">
        <div className="col">
          {/* Стороны */}
          <section className="card">
            <div className="two">
              <div>
                <h2 className="card-title">Отправитель / плательщик</h2>
                <dl className="info-list">
                  <div className="info-row"><dt>Клиент</dt><dd>
                    <Link href={`/clients/${parcel.customer.id}`} className="link">
                      {parcel.customer.code ? <span className="code-pill">{parcel.customer.code}</span> : null} {parcel.customer.name}
                    </Link>
                  </dd></div>
                  <div className="info-row"><dt>Телефон</dt><dd>{dash(parcel.customer.phone)}</dd></div>
                  <div className="info-row"><dt>Страна</dt><dd>{dash(parcel.customer.country)}</dd></div>
                </dl>
              </div>
              <div>
                <h2 className="card-title">Получатель</h2>
                {rcpt ? (
                  <dl className="info-list">
                    <div className="info-row"><dt>ФИО</dt><dd>
                      <Link href={`/recipients/${rcpt.id}`} className="link">{rcpt.name}</Link>
                    </dd></div>
                    <div className="info-row"><dt>Страна</dt><dd>{dash(rcpt.country)}{rcpt.countryCode ? ` (${rcpt.countryCode})` : ""}</dd></div>
                    <div className="info-row"><dt>Город, индекс</dt><dd>{dash([rcpt.city, rcpt.postalCode].filter(Boolean).join(", ") || null)}</dd></div>
                    <div className="info-row"><dt>Адрес</dt><dd>{dash(rcpt.address)}</dd></div>
                    <div className="info-row"><dt>Телефон</dt><dd>{dash([rcpt.phoneDialCode, rcpt.phone].filter(Boolean).join(" ") || null)}</dd></div>
                  </dl>
                ) : (
                  <p className="empty">Получатель не указан</p>
                )}
              </div>
            </div>
          </section>

          {/* Вес и габариты */}
          <section className="card">
            <h2 className="card-title">Вес и габариты</h2>
            <div className="metrics">
              <div className="metric"><span className="metric-v">{formatNumber(actual)}</span><span className="metric-l">факт, кг</span></div>
              <div className="metric"><span className="metric-v">{formatNumber(volumetric)}</span><span className="metric-l">объёмный, кг</span></div>
              <div className="metric metric--accent"><span className="metric-v">{formatNumber(billable)}</span><span className="metric-l">расчётный, кг</span></div>
              <div className="metric"><span className="metric-v">{hasDims ? `${formatNumber(dims[0])}×${formatNumber(dims[1])}×${formatNumber(dims[2])}` : "—"}</span><span className="metric-l">габариты Д×Ш×В, см</span></div>
            </div>
            <p className="hint">Объёмный вес = Д×Ш×В ÷ {volumetricDivisor}. Расчётный вес по умолчанию — наибольший из факта и объёмного.</p>
          </section>

          {/* Состав посылки */}
          <section className="card">
            <h2 className="card-title">Состав посылки ({parcel.orders.length})</h2>
            <ul className="orders">
              {parcel.orders.map((o) => (
                <li key={o.id} className="ord">
                  <div className="ord-main">
                    <span className="ord-name">{o.productNameText ?? "Товар"}</span>
                    <span className="ord-qty">{o.quantity} шт</span>
                  </div>
                  <div className="ord-meta">
                    <span className="mono">{o.trackNumber ?? "—"}</span>
                    <span className="ord-status">{orderStatusLabel(o.status)}</span>
                  </div>
                  {o.customerComment?.trim() ? <p className="ord-comment">💬 {o.customerComment}</p> : null}
                </li>
              ))}
            </ul>
          </section>

          {/* Квитанция */}
          <section className="card">
            <h2 className="card-title">Квитанция</h2>
            <table className="rcpt">
              <tbody>
                <tr><td>Отправка</td><td className="r">{formatUsd(shipping)}</td><td className="r muted">¥{(shipping * rate).toFixed(2)}</td></tr>
                {parcel.services.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="r">{formatUsd(Number(s.priceUsd))}</td>
                    <td className="r muted">¥{Number(s.priceCny).toFixed(2)}</td>
                  </tr>
                ))}
                {parcel.discountPercent && Number(parcel.discountPercent) > 0 ? (
                  <tr className="disc"><td>Скидка {Number(parcel.discountPercent)}%</td><td className="r" colSpan={2}>−</td></tr>
                ) : null}
                {hasDuty && euDutyPassToClient ? (
                  <tr>
                    <td>Таможенная пошлина ЕС (€3 × {dutyLines})</td>
                    <td className="r">{formatUsd(dutyUsd)}</td>
                    <td className="r muted">€{dutyEur.toFixed(2)}</td>
                  </tr>
                ) : null}
                <tr className="total">
                  <td>ИТОГО</td>
                  <td className="r">{formatUsd(Number(parcel.totalUsd))}</td>
                  <td className="r">¥{Number(parcel.totalCny).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <p className="hint">Курс: {rate} ¥/$</p>
            {hasDuty && !euDutyPassToClient ? (
              <p className="hint">Таможенная пошлина ЕС €{dutyEur.toFixed(2)} ({dutyLines} поз.) оплачивается отправителем — не включена в счёт.</p>
            ) : null}
          </section>

          {/* Отслеживание */}
          <section className="card">
            <h2 className="card-title">Отслеживание</h2>
            <dl className="info-list">
              <div className="info-row"><dt>Трек-номер</dt><dd>
                {parcel.trackingNumber ? (
                  <a className="link track-link" href={trackUrl!} target="_blank" rel="noopener noreferrer">
                    <span className="mono">{parcel.trackingNumber}</span> <ExternalLink size={13} />
                  </a>
                ) : <span className="muted">не присвоен</span>}
              </dd></div>
              <div className="info-row"><dt>Отправлена</dt><dd>{shippedAt ? formatDateTime(shippedAt) : "—"}</dd></div>
              <div className="info-row"><dt>Доставлена</dt><dd>{deliveredAt ? formatDateTime(deliveredAt) : "—"}</dd></div>
            </dl>
          </section>
        </div>

        <aside className="col col--side">
          <section className="card">
            <ParcelControls
              parcelId={parcel.id}
              status={parcel.status}
              isPaid={parcel.isPaid}
              initial={{
                actualWeightKg: parcel.actualWeightKg != null ? String(Number(parcel.actualWeightKg)) : "",
                billableWeightKg: parcel.billableWeightKg != null ? String(Number(parcel.billableWeightKg)) : "",
                lengthCm: parcel.lengthCm != null && Number(parcel.lengthCm) > 0 ? String(Number(parcel.lengthCm)) : "",
                widthCm: parcel.widthCm != null && Number(parcel.widthCm) > 0 ? String(Number(parcel.widthCm)) : "",
                heightCm: parcel.heightCm != null && Number(parcel.heightCm) > 0 ? String(Number(parcel.heightCm)) : "",
                volumetricDivisor,
                consolidation: has(parcel.services, "CONSOLIDATION"),
                compactPack: has(parcel.services, "COMPACT_PACK"),
                standardCheck: has(parcel.services, "STANDARD_CHECK"),
                reinforcedPackUsd: amount(parcel.services, "REINFORCED_PACK"),
                localDeliveryUsd: amount(parcel.services, "LOCAL_DELIVERY"),
                insurancePercent: "",
                discountPercent: parcel.discountPercent ? String(Number(parcel.discountPercent)) : "",
                trackingNumber: parcel.trackingNumber ?? "",
              }}
            />
          </section>
        </aside>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 6px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-sep { color: var(--color-border-strong); }
        .title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .mono { font-family: var(--font-mono); }
        .subline { margin: 8px 0 0; font-size: 13px; color: var(--color-muted); }

        .badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: var(--radius-full); font-size: 12px; font-weight: 600; }
        .badge--new { color: var(--color-status-new); background: var(--color-status-new-bg); }
        .badge--processing { color: var(--color-status-processing); background: var(--color-status-processing-bg); }
        .badge--shipped { color: var(--color-status-shipped); background: var(--color-status-shipped-bg); }
        .badge--completed { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .badge--canceled { color: var(--color-status-canceled); background: var(--color-status-canceled-bg); }
        .badge--assembled { color: var(--color-status-assembled); background: var(--color-status-assembled-bg); }
        .badge--ready { color: var(--color-status-ready); background: var(--color-status-ready-bg); }
        .badge--utilized { color: var(--color-status-utilized); background: var(--color-status-utilized-bg); }
        .badge--paid { color: var(--color-success); background: var(--color-success-bg); }

        .grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
        .col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
        .col--side { position: sticky; top: 16px; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card); }
        .card-title { font-size: 14px; font-weight: 600; margin: 0 0 16px; color: var(--color-text); }

        .two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .info-list { display: flex; flex-direction: column; gap: 10px; margin: 0; }
        .info-row { display: flex; gap: 12px; font-size: 13px; }
        .info-row dt { width: 120px; flex-shrink: 0; color: var(--color-muted); }
        .info-row dd { flex: 1; color: var(--color-text); margin: 0; min-width: 0; word-break: break-word; }
        .link { color: var(--color-accent); text-decoration: none; }
        .link:hover { text-decoration: underline; }
        .track-link { display: inline-flex; align-items: center; gap: 5px; }
        .code-pill { display: inline-flex; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); }
        .muted { color: var(--color-muted); }
        .empty { margin: 0; font-size: 13px; color: var(--color-muted); }
        .hint { margin: 12px 0 0; font-size: 12px; color: var(--color-muted); line-height: 1.5; }

        .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .metric { display: flex; flex-direction: column; gap: 3px; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--color-surface) 60%, transparent); }
        .metric--accent { border-color: color-mix(in srgb, var(--color-accent) 40%, transparent); background: color-mix(in srgb, var(--color-accent) 8%, transparent); }
        .metric-v { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-text); }
        .metric-l { font-size: 11px; color: var(--color-muted); }

        .orders { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .ord { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
        .ord-main { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
        .ord-name { font-size: 14px; font-weight: 600; }
        .ord-qty { font-size: 12px; color: var(--color-muted); white-space: nowrap; }
        .ord-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; color: var(--color-muted); }
        .ord-status { color: var(--color-text-secondary); }
        .ord-comment { margin: 4px 0 0; font-size: 12px; color: var(--color-text); line-height: 1.45; white-space: pre-wrap; word-break: break-word; }

        .rcpt { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .rcpt td { padding: 9px 6px; border-bottom: 1px solid var(--color-border); }
        .rcpt .r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .rcpt .muted { color: var(--color-muted); }
        .rcpt .disc td { color: var(--color-status-canceled); }
        .rcpt .total td { font-weight: 700; font-size: 15px; border-bottom: none; border-top: 2px solid var(--color-border-strong); padding-top: 12px; }

        @media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } .col--side { position: static; } }
        @media (max-width: 560px) { .two { grid-template-columns: 1fr; gap: 16px; } .metrics { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}
