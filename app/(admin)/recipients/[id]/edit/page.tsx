import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateRecipient } from "@/actions/recipients";
import RecipientForm from "../../recipient-form";
import Form from "@/components/form/form";

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
    <Form formKey="recipient-edit" title={`Редактирование получателя: ${recipient.name}`} guid={recipient.id}>
      <RecipientForm
        recipient={recipient}
        customers={customers}
        countries={countries}
        action={action}
        returnTo={returnTo}
      />
    </Form>
  );
}
