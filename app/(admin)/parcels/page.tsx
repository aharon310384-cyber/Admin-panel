import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatUsd, formatNumber, formatDateTime } from "@/lib/utils";
import { parcelStatusLabel, deliveryTypeLabel } from "@/lib/statuses";

export const metadata: Metadata = { title: "Посылки" };

export default async function ParcelsPage() {
  const parcels = await prisma.parcel.findMany({
    where: { deletedAt: null },
    include: { customer: { select: { name: true, code: true } }, recipient: { select: { name: true } }, _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Посылки</h1>
          <p className="page-subtitle">{parcels.length} посылок</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Статус</th>
                <th>Клиент</th>
                <th>Получатель</th>
                <th>Доставка</th>
                <th>Заказов</th>
                <th>Вес кг</th>
                <th>Итог $</th>
                <th>Оплата</th>
                <th>Создана</th>
              </tr>
            </thead>
            <tbody>
              {parcels.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/parcels/${p.id}`} className="num">{p.number}</Link></td>
                  <td><span className="st">{parcelStatusLabel(p.status)}</span></td>
                  <td><span className="code-pill">{p.customer.code ?? "—"}</span> {p.customer.name}</td>
                  <td className="text-muted">{p.recipient?.name ?? "—"}</td>
                  <td className="text-muted">{deliveryTypeLabel(p.deliveryType)}</td>
                  <td className="tabular">{p._count.orders}</td>
                  <td className="tabular">{formatNumber(Number(p.billableWeightKg ?? 0))}</td>
                  <td className="tabular strong">{formatUsd(Number(p.totalUsd))}</td>
                  <td>{p.isPaid ? <span className="paid">Оплачено</span> : <span className="text-muted">—</span>}</td>
                  <td className="text-muted">{formatDateTime(p.createdAt)}</td>
                </tr>
              ))}
              {parcels.length === 0 && (
                <tr><td colSpan={10} className="table-empty">Посылок пока нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }
        .btn-add { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; background: var(--color-accent); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: #fff; text-decoration: none; white-space: nowrap; }
        .btn-add:hover { opacity: 0.9; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { min-width: 1000px; width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); white-space: nowrap; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .num { font-family: var(--font-mono); font-weight: 600; color: var(--color-accent); text-decoration: none; }
        .st { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; color: var(--color-accent); background: oklch(52% 0.14 42 / 0.08); }
        .strong { font-weight: 700; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }
        .paid { color: var(--color-status-completed); font-weight: 600; }
        .code-pill { display: inline-flex; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
      `}</style>
    </div>
  );
}
