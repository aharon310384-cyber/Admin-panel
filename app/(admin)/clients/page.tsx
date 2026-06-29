import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import ClickableRow from "@/components/ui/clickable-row";

export const metadata: Metadata = { title: "Клиенты" };

function dash(v: string | null | undefined): string {
  return v?.trim() || "—";
}

export default async function ClientsPage() {
  const clients = await prisma.customer.findMany({
    where: { deletedAt: null },
    include: {
      _count: { select: { orders: { where: { deletedAt: null } }, parcels: { where: { deletedAt: null } }, recipients: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Клиенты</h1>
          <p className="page-subtitle">{clients.length} клиентов</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Код</th>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Email</th>
                <th>Город</th>
                <th>Получателей</th>
                <th>Заказов</th>
                <th>Посылок</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <ClickableRow key={c.id} href={`/clients/${c.id}`}>
                  <td><span className="code-pill">{dash(c.code)}</span></td>
                  <td className="strong">{c.name}</td>
                  <td className="mono text-muted">{dash(c.phone)}</td>
                  <td className="text-muted">{dash(c.email)}</td>
                  <td className="text-muted">{dash(c.city)}</td>
                  <td className="tabular">{c._count.recipients}</td>
                  <td className="tabular">{c._count.orders}</td>
                  <td className="tabular">{c._count.parcels}</td>
                  <td className="text-muted">{formatDateTime(c.createdAt)}</td>
                </ClickableRow>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan={9} className="table-empty">Клиентов пока нет</td></tr>
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
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { min-width: 900px; width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); white-space: nowrap; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .strong { font-weight: 600; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .tabular { font-variant-numeric: tabular-nums; }
        .text-muted { color: var(--color-muted); }
        .code-pill { display: inline-flex; min-width: 36px; justify-content: center; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); color: var(--color-text); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
      `}</style>
    </div>
  );
}
