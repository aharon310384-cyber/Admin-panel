import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateRecipient } from "@/actions/recipients";
import RecipientForm from "../../recipient-form";

export const metadata: Metadata = { title: "Редактирование получателя" };

export default async function EditRecipientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect(`/recipients/${id}`);

  const [recipient, customers, countries] = await Promise.all([
    prisma.recipient.findFirst({ where: { id, deletedAt: null } }),
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
        phoneCode: true,
        phoneNumberMin: true,
        phoneNumberMax: true,
        postalCodeRegex: true,
        postalCodeExample: true,
        aliases: true,
      },
      orderBy: { nameRu: "asc" },
    }),
  ]);

  if (!recipient) notFound();

  const action = updateRecipient.bind(null, id);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/recipients" className="breadcrumb-link">Получатели</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/recipients/${id}`} className="breadcrumb-link">{recipient.name}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Редактирование</span>
          </div>
          <h1 className="page-title">Редактирование получателя</h1>
        </div>
      </div>

      <RecipientForm
        recipient={recipient}
        customers={customers}
        countries={countries}
        action={action}
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
