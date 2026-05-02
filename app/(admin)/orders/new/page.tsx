import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import OrderForm from "../order-form";

export const metadata: Metadata = { title: "Новый заказ" };

export default async function NewOrderPage() {
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.product.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, price: true },
    }),
  ]);

  const productsForForm = products.map((p) => ({
    ...p,
    price: Number(p.price),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/orders" className="breadcrumb-link">Заказы</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Новый заказ</span>
          </div>
          <h1 className="page-title">Новый заказ</h1>
        </div>
      </div>

      <OrderForm customers={customers} products={productsForForm} />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-sep { color: var(--color-border-strong); }
      `}</style>
    </div>
  );
}
