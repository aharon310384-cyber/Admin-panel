import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Виды доставки" };

export default async function DeliveryMethodsPage() {
  const methods = await prisma.deliveryMethod.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { orders: true, parcels: true, tariffs: true } },
    },
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Виды доставки</h1>
          <p className="page-subtitle">
            Справочник видов доставки. Привязан к заказам, посылкам и тарифам по коду.
          </p>
        </div>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Код</th>
                <th>Название (RU)</th>
                <th>EN</th>
                <th className="tabular">Порядок</th>
                <th>Активен</th>
                <th className="tabular">Заказы</th>
                <th className="tabular">Посылки</th>
                <th className="tabular">Тарифы</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.code}>
                  <td><span className="code">{m.code}</span></td>
                  <td className="strong">{m.nameRu}</td>
                  <td className="muted">{m.nameEn ?? "—"}</td>
                  <td className="tabular">{m.sortOrder}</td>
                  <td>{m.active ? "Да" : "Нет"}</td>
                  <td className="tabular">{m._count.orders}</td>
                  <td className="tabular">{m._count.parcels}</td>
                  <td className="tabular">{m._count.tariffs}</td>
                </tr>
              ))}
              {methods.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">Справочник пуст.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 13px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: middle; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .code { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: var(--radius-full); font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: var(--color-status-new); background: var(--color-status-new-bg); }
        .strong { font-weight: 600; }
        .muted { color: var(--color-muted); }
        .tabular { font-variant-numeric: tabular-nums; white-space: nowrap; }
      `}</style>
    </div>
  );
}
