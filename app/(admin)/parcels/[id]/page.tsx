import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatUsd, formatNumber } from "@/lib/utils";
import { parcelStatusLabel, orderStatusLabel, deliveryTypeLabel } from "@/lib/statuses";
import ParcelControls from "@/components/parcels/parcel-controls";

export const metadata: Metadata = { title: "Посылка" };

function has(services: { serviceCode: string }[], code: string): boolean {
  return services.some((s) => s.serviceCode === code);
}
function amount(services: { serviceCode: string; priceUsd: unknown }[], code: string): string {
  const s = services.find((x) => x.serviceCode === code);
  return s ? String(Number(s.priceUsd)) : "";
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
    },
  });
  if (!parcel) notFound();

  const rate = Number(parcel.exchangeRateCnyPerUsd);
  const shipping = Number(parcel.shippingCostUsd ?? 0);

  return (
    <div className="page">
      <Link href="/parcels" className="back"><ArrowLeft size={16} /> К посылкам</Link>

      <div className="head">
        <div>
          <span className="num">{parcel.number}</span>
          <span className="badge">{parcelStatusLabel(parcel.status)}</span>
        </div>
        <div className="head-meta">
          <span className="code-pill">{parcel.customer.code ?? "—"}</span> {parcel.customer.name}
          {" · "}{parcel.recipient?.name ?? "получатель не указан"}
          {" · "}{deliveryTypeLabel(parcel.deliveryType)}
          {" · "}{formatNumber(Number(parcel.billableWeightKg ?? 0))} кг
          {parcel.isPaid && <span className="paid"> · оплачено</span>}
        </div>
      </div>

      <div className="grid">
        <div className="col">
          {/* Заказы в посылке */}
          <section className="card">
            <h2 className="card-h">Заказы в посылке ({parcel.orders.length})</h2>
            <ul className="orders">
              {parcel.orders.map((o) => (
                <li key={o.id} className="ord">
                  <span className="ord-name">{o.productNameText ?? "Товар"}</span>
                  <span className="ord-meta">{o.trackNumber ?? "—"} · {o.quantity} шт · {orderStatusLabel(o.status)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Квитанция */}
          <section className="card">
            <h2 className="card-h">Квитанция</h2>
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
                <tr className="total">
                  <td>ИТОГО</td>
                  <td className="r">{formatUsd(Number(parcel.totalUsd))}</td>
                  <td className="r">¥{Number(parcel.totalCny).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <p className="rate">Курс: {rate} ¥/$</p>
          </section>
        </div>

        <div className="col">
          <section className="card">
            <ParcelControls
              parcelId={parcel.id}
              status={parcel.status}
              isPaid={parcel.isPaid}
              initial={{
                consolidation: has(parcel.services, "CONSOLIDATION"),
                compactPack: has(parcel.services, "COMPACT_PACK"),
                standardCheck: has(parcel.services, "STANDARD_CHECK"),
                reinforcedPackUsd: amount(parcel.services, "REINFORCED_PACK"),
                localDeliveryUsd: amount(parcel.services, "LOCAL_DELIVERY"),
                insurancePercent: "",
                discountPercent: parcel.discountPercent ? String(Number(parcel.discountPercent)) : "",
              }}
            />
          </section>
        </div>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 14px; }
        .back { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; font-size: 13px; font-weight: 600; color: var(--color-accent); text-decoration: none; }
        .head { display: flex; flex-direction: column; gap: 6px; }
        .num { font-family: var(--font-mono); font-size: 22px; font-weight: 700; color: var(--color-text); }
        .badge { margin-left: 12px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--color-accent); background: oklch(52% 0.14 42 / 0.08); }
        .head-meta { font-size: 13px; color: var(--color-muted); }
        .paid { color: var(--color-status-completed); font-weight: 600; }
        .grid { display: grid; grid-template-columns: 1fr 360px; gap: 16px; align-items: start; }
        .col { display: flex; flex-direction: column; gap: 16px; }
        .card { padding: 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
        .card-h { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: var(--color-text); }
        .orders { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .ord { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
        .ord-name { font-size: 13.5px; font-weight: 600; }
        .ord-meta { font-size: 12px; color: var(--color-muted); }
        .rcpt { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .rcpt td { padding: 8px 6px; border-bottom: 1px solid var(--color-border); }
        .rcpt .r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .rcpt .muted { color: var(--color-muted); }
        .rcpt .disc td { color: var(--color-status-canceled); }
        .rcpt .total td { font-weight: 700; font-size: 15px; border-bottom: none; border-top: 2px solid var(--color-border); }
        .rate { margin: 8px 0 0; font-size: 12px; color: var(--color-muted); }
        .code-pill { display: inline-flex; align-items: center; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); }
        @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
