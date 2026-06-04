import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ParcelForm from "../parcel-form";

export const metadata: Metadata = { title: "Новая посылка" };

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId: initialCustomerId } = await searchParams;

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        code: true,
        clientCode: true,
        country: true,
        countryCode: true,
      },
    }),
    prisma.order.findMany({
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
            <Link href="/parcels" className="breadcrumb-link">Посылки</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Новая посылка</span>
          </div>
          <h1 className="page-title">Новая посылка</h1>
        </div>
      </div>

      <ParcelForm
        customers={customers}
        products={productsForForm}
        initialCustomerId={initialCustomerId}
      />

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
