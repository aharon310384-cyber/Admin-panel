import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/actions/customers";
import ClientForm from "../client-form";

export const metadata: Metadata = { title: "Новый клиент" };

export default async function NewClientPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/clients");

  const countries = await prisma.country.findMany({
    select: { code: true, nameRu: true, nameEn: true },
    orderBy: { nameRu: "asc" },
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/clients" className="breadcrumb-link">
              Клиенты
            </Link>
            <span className="breadcrumb-sep">/</span>
            <span>Новый</span>
          </div>
          <h1 className="page-title">Новый клиент</h1>
        </div>
      </div>

      <ClientForm countries={countries} action={createClient} />

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
