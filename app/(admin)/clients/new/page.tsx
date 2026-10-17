import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/actions/customers";
import ClientForm from "../client-form";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Новый клиент" };

export default async function NewClientPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/clients");

  const countries = await prisma.country.findMany({
    select: { code: true, nameRu: true, nameEn: true },
    orderBy: { nameRu: "asc" },
  });

  return (
    <Form formKey="client-new" title="Новый клиент">
      <ClientForm countries={countries} action={createClient} />
    </Form>
  );
}
