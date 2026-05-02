import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateCustomer } from "@/actions/customers";
import CustomerEditForm from "./customer-edit-form";

export const metadata: Metadata = { title: "Редактирование получателя" };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect(`/customers/${id}`);

  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
  });

  if (!customer) notFound();

  const action = updateCustomer.bind(null, id);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/customers" className="breadcrumb-link">Получатели</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/customers/${id}`} className="breadcrumb-link">{customer.name}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Редактирование</span>
          </div>
          <h1 className="page-title">Редактирование получателя</h1>
        </div>
      </div>

      <CustomerEditForm customer={customer} action={action} />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-link:hover { text-decoration: underline; }
        .breadcrumb-sep { color: var(--color-border-strong); }
      `}</style>
    </div>
  );
}
