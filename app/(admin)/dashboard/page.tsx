import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCny } from "@/lib/utils";
import {
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import OrdersChart from "@/components/ui/orders-chart";
import { ParcelStatusBadge } from "@/components/ui/status-badge";
import { startOfDay, startOfWeek, subDays, format } from "date-fns";
import { ru } from "date-fns/locale";

export const metadata: Metadata = { title: "Операции" };

async function getDashboardData() {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const [
    ordersToday,
    weekRevenue,
    activeCustomers,
    recentOrders,
    topProducts,
    weeklyOrders,
  ] = await Promise.all([
    prisma.parcel.count({
      where: { createdAt: { gte: today }, deletedAt: null },
    }),
    prisma.parcel.aggregate({
      where: {
        createdAt: { gte: weekStart },
        deletedAt: null,
        status: { not: "CANCELED" },
      },
      _sum: { totalCny: true },
    }),
    prisma.customer.count({
      where: {
        deletedAt: null,
        parcels: { some: { deletedAt: null } },
      },
    }),
    prisma.parcel.findMany({
      where: { deletedAt: null },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.parcelItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const day = startOfDay(subDays(new Date(), 6 - i));
        const nextDay = startOfDay(subDays(new Date(), 5 - i));
        return prisma.parcel.count({
          where: {
            createdAt: { gte: day, lt: nextDay },
            deletedAt: null,
          },
        }).then((count) => ({
          date: format(day, "d MMM", { locale: ru }),
          count,
        }));
      })
    ),
  ]);

  const productIds = topProducts.map((p) => p.productId);
  const products = await prisma.order.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, price: true },
  });

  const topProductsWithNames = topProducts.map((tp) => ({
    ...tp,
    product: products.find((p) => p.id === tp.productId),
  }));

  return {
    ordersToday,
    weekRevenue: Number(weekRevenue._sum.totalCny ?? 0),
    activeCustomers,
    recentOrders,
    topProductsWithNames,
    weeklyOrders,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const data = await getDashboardData();

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Операции PostmanFox</h1>
          <p className="page-subtitle">
            Рабочий центр посылок, {session?.user.name}
          </p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon metric-icon--blue">
            <Truck size={20} />
          </div>
          <div className="metric-body">
            <p className="metric-label">Посылок сегодня</p>
            <p className="metric-value">{data.ordersToday}</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-icon--green">
            <TrendingUp size={20} />
          </div>
          <div className="metric-body">
            <p className="metric-label">Выручка за неделю</p>
            <p className="metric-value">{formatCny(data.weekRevenue)}</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-icon--orange">
            <Users size={20} />
          </div>
          <div className="metric-body">
            <p className="metric-label">Активных получателей</p>
            <p className="metric-value">{data.activeCustomers}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Посылки за последние 7 дней</h2>
        <OrdersChart data={data.weeklyOrders} />
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h2 className="card-title">Топ-5 заказов</h2>
          <div className="top-products">
            {data.topProductsWithNames.map((item, i) => (
              <div key={item.productId} className="top-product-row">
                <span className="top-product-rank">#{i + 1}</span>
                <span className="top-product-name">
                  {item.product?.name ?? "—"}
                </span>
                <span className="top-product-qty">
                  {item._sum.quantity} шт.
                </span>
              </div>
            ))}
            {data.topProductsWithNames.length === 0 && (
              <p className="empty-text">Нет данных по заказам</p>
            )}
          </div>
        </div>

        <div className="card card--wide">
          <h2 className="card-title">Последние посылки</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Получатель</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/parcels/${order.id}`} className="link">
                        {order.number}
                      </Link>
                    </td>
                    <td>{order.customer.name}</td>
                    <td>
                      <ParcelStatusBadge status={order.status} />
                    </td>
                    <td className="tabular">{formatCny(order.totalCny)}</td>
                  </tr>
                ))}
                {data.recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-text" style={{ textAlign: "center" }}>
                      Посылок пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard { display: flex; flex-direction: column; gap: 24px; }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .page-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0;
        }

        .page-subtitle {
          font-size: 13px;
          color: var(--color-muted);
          margin: 4px 0 0;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .metric-card {
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow-card);
        }

        .metric-icon {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .metric-icon--blue { background: var(--color-status-new-bg); color: var(--color-status-new); }
        .metric-icon--green { background: var(--color-success-bg); color: var(--color-success); }
        .metric-icon--orange { background: oklch(52% 0.14 42 / 0.12); color: var(--color-accent); }

        .metric-label {
          font-size: 12px;
          color: var(--color-muted);
          margin: 0 0 4px;
        }

        .metric-value {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          font-variant-numeric: tabular-nums;
          margin: 0;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 16px;
          align-items: start;
        }

        .card {
          background: var(--color-surface);
          backdrop-filter: blur(16px) saturate(1.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 20px;
          box-shadow: var(--shadow-card);
        }

        .card-title {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 16px;
          color: var(--color-text);
        }

        .top-products { display: flex; flex-direction: column; gap: 10px; }

        .top-product-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }

        .top-product-rank {
          width: 20px;
          color: var(--color-muted);
          font-weight: 600;
          flex-shrink: 0;
        }

        .top-product-name {
          flex: 1;
          color: var(--color-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .top-product-qty {
          color: var(--color-muted);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .table-wrap { overflow-x: auto; }

        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .table th {
          text-align: left;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-muted);
          border-bottom: 1px solid var(--color-border);
        }

        .table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text);
        }

        .table tbody tr:last-child td { border-bottom: none; }

        .table tbody tr:hover td { background: var(--color-muted-bg); }

        .link {
          color: var(--color-accent);
          text-decoration: none;
          font-weight: 500;
        }

        .link:hover { text-decoration: underline; }

        .tabular { font-variant-numeric: tabular-nums; }

        .empty-text {
          color: var(--color-muted);
          font-size: 13px;
        }

        @media (max-width: 900px) {
          .metrics-grid { grid-template-columns: 1fr 1fr; }
          .dashboard-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 600px) {
          .metrics-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
