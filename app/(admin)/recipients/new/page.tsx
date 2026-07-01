import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createRecipient } from "@/actions/recipients";
import RecipientForm from "../recipient-form";

export const metadata: Metadata = { title: "Новый получатель" };

export default async function NewRecipientPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; customerId?: string }>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/recipients");

  const { returnTo } = await searchParams;

  const [customers, countries] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.country.findMany({
      select: {
        code: true,
        nameRu: true,
        nameEn: true,
        postalCodeRegex: true,
        postalCodeExample: true,
      },
      orderBy: { nameRu: "asc" },
    }),
  ]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/recipients" className="breadcrumb-link">
              Получатели
            </Link>
            <span className="breadcrumb-sep">/</span>
            <span>Новый</span>
          </div>
          <h1 className="page-title">Новый получатель</h1>
        </div>
      </div>

      <RecipientForm
        customers={customers}
        countries={countries}
        action={createRecipient}
        returnTo={returnTo}
      />

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
