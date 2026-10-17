import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createRecipient } from "@/actions/recipients";
import RecipientForm from "../recipient-form";
import Form from "@/components/form/form";

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

  return (
    <Form formKey="recipient-new" title="Новый получатель">
      <RecipientForm
        customers={customers}
        countries={countries}
        action={createRecipient}
        returnTo={returnTo}
      />
    </Form>
  );
}
