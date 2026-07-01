import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import ClickableRow from "@/components/ui/clickable-row";

export const metadata: Metadata = { title: "Получатели" };

function dash(v: string | null | undefined): string {
  return v?.trim() || "—";
}

export default async function RecipientsPage() {
  const recipients = await prisma.recipient.findMany({
    where: { deletedAt: null },
    include: { customer: { select: { name: true, code: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Получатели</h1>
          <p className="page-subtitle">{recipients.length} получателей · привязаны к клиентам</p>
        </div>
        <Link href="/recipients/new" className="btn-add">
          <Plus size={16} />
          Добавить получателя
        </Link>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Страна</th>
                <th>Город</th>
                <th>Адрес</th>
                <th>Индекс</th>
                <th>Клиент</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <ClickableRow key={r.id} href={`/recipients/${r.id}`}>
                  <td className="strong">{dash(r.name)}</td>
                  <td className="mono text-muted">{dash(r.phone)}</td>
                  <td className="text-muted">{dash(r.country)}</td>
                  <td className="text-muted">{dash(r.city)}</td>
                  <td className="addr">{dash(r.address)}</td>
                  <td className="mono text-muted">{dash(r.postalCode)}</td>
                  <td><span className="code-pill">{dash(r.customer.code)}</span> {r.customer.name}</td>
                  <td className="text-muted">{formatDateTime(r.createdAt)}</td>
                </ClickableRow>
              ))}
              {recipients.length === 0 && (
                <tr><td colSpan={8} className="table-empty">Получателей пока нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .btn-add { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; background: var(--color-accent); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: #fff; text-decoration: none; white-space: nowrap; transition: opacity 0.15s; }
        .btn-add:hover { opacity: 0.9; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { min-width: 1000px; width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .strong { font-weight: 600; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .addr { max-width: 280px; color: var(--color-text); }
        .text-muted { color: var(--color-muted); }
        .code-pill { display: inline-flex; padding: 2px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; background: var(--color-muted-bg); }
        .table-empty { text-align: center; padding: 40px 16px !important; color: var(--color-muted); }
      `}</style>
    </div>
  );
}
