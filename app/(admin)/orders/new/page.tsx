import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import OrderBulkImport from "@/components/orders/order-bulk-import";

export const metadata: Metadata = { title: "Новый заказ" };

export default async function NewOrderPage() {
  const [customers, recipients, productNames, countries] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.recipient.findMany({
      where: { deletedAt: null },
      select: { id: true, customerId: true, name: true, country: true },
      orderBy: { name: "asc" },
    }),
    prisma.productName.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, nameRu: true, category: true, hsCode: true },
      orderBy: { nameRu: "asc" },
    }),
    prisma.country.findMany({
      select: { code: true, nameRu: true },
      orderBy: { nameRu: "asc" },
    }),
  ]);

  return (
    <div className="page">
      <Link href="/orders" className="back">
        <ArrowLeft size={16} />
        К заказам
      </Link>
      <h1 className="page-title">Новый заказ</h1>
      <p className="page-subtitle">Один заказ = один товар + один трек-номер. Несколько трек-номеров — несколько заказов.</p>

      <OrderBulkImport customers={customers} recipients={recipients} productNames={productNames} countries={countries} />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 12px; max-width: 860px; }
        .back { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; font-size: 13px; font-weight: 600; color: var(--color-accent); text-decoration: none; }
        .page-title { font-size: 24px; font-weight: 700; margin: 6px 0 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 0; }
        .card { margin-top: 8px; padding: 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
      `}</style>
    </div>
  );
}
