import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dedupeCustomers } from "@/lib/customer-dedupe";
import OrderForm from "../order-form";
import { createOrder } from "@/actions/orders";

export const metadata: Metadata = { title: "Новый заказ" };

export default async function NewProductPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/orders");

  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      lastName: true,
      firstName: true,
      middleName: true,
      email: true,
      phone: true,
      code: true,
      clientCode: true,
      country: true,
      city: true,
      postalCode: true,
      address: true,
      informationDate: true,
      sourceRow: true,
    },
  });

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

      <OrderForm action={createOrder} customers={dedupeCustomers(customers)} />

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
