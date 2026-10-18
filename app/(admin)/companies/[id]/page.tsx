import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateCompany } from "@/actions/companies";
import { COMPANY_FIELDS, companyImageUrl } from "@/lib/company";
import { formatDateTime } from "@/lib/utils";
import Form from "@/components/form/form";
import CompanyForm from "../company-form";
import CompanyImages from "../company-images";

export const metadata: Metadata = { title: "Компания" };

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const company = await prisma.company.findUnique({ where: { id }, select: COMPANY_FIELDS });
  if (!company) notFound();

  return (
    <Form formKey="company" title={company.name} footer={<>Изменена {formatDateTime(company.updatedAt)}</>}>
      <div className="company-card">
        <CompanyImages
          companyId={company.id}
          urls={{ logo: companyImageUrl(company, "logo"), icon: companyImageUrl(company, "icon") }}
          isAdmin={isAdmin}
        />
        <CompanyForm company={company} action={updateCompany.bind(null, company.id)} isAdmin={isAdmin} />
      </div>
      <style>{`
        .company-card { display: flex; flex-direction: column; gap: 16px; max-width: 920px; }
      `}</style>
    </Form>
  );
}
