import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createCompany } from "@/actions/companies";
import Form from "@/components/form/form";
import CompanyForm from "../company-form";

export const metadata: Metadata = { title: "Новая компания" };

export default async function NewCompanyPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/companies");

  return (
    <Form formKey="company-new" title="Новая компания" footer="Логотип и знак загружаются в карточке после создания.">
      <div style={{ maxWidth: 920 }}>
        <CompanyForm action={createCompany} isAdmin />
      </div>
    </Form>
  );
}
