import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { COMPANY_FIELDS, companyImageUrl } from "@/lib/company";
import { siteLabel } from "@/lib/brand";
import ClickableRow from "@/components/ui/clickable-row";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Компании" };

export default async function CompaniesPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const companies = await prisma.company.findMany({ select: COMPANY_FIELDS, orderBy: [{ createdAt: "asc" }] });

  return (
    <>
      <Form
        formKey="companies"
        title="Компании"
        commands={
          isAdmin ? (
            <Link href="/companies/new" className="cmd cmd--primary" data-command="create">
              <Plus size={15} />
              Создать
            </Link>
          ) : undefined
        }
        footer="Название, логотип, сайт и тексты Telegram — здесь, а не в программе. Бренд админки — у компании-склада, бренд кабинета клиента и Telegram — у компании клиентов."
      >
        <section className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Логотип</th>
                  <th>Название</th>
                  <th>Код</th>
                  <th>Бренд</th>
                  <th>Сайт</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  const logo = companyImageUrl(company, "logo") ?? companyImageUrl(company, "icon");
                  return (
                    <ClickableRow key={company.id} href={`/companies/${company.id}`}>
                      <td className="logo-cell">
                        {logo ? <Image src={logo} alt="" width={84} height={28} unoptimized className="logo" /> : <span className="muted">—</span>}
                      </td>
                      <td className="strong">
                        <Link href={`/companies/${company.id}`} className="name-link">{company.name}</Link>
                      </td>
                      <td><span className="code">{company.code}</span></td>
                      <td>
                        {company.adminBrand && <span className="role">Админка</span>}
                        {company.cabinetBrand && <span className="role">Кабинет и Telegram</span>}
                        {!company.adminBrand && !company.cabinetBrand && <span className="muted">—</span>}
                      </td>
                      <td className="muted">{company.siteUrl ? siteLabel(company.siteUrl) : "—"}</td>
                    </ClickableRow>
                  );
                })}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Компаний пока нет — система показывает нейтральное название без логотипа.
                      {isAdmin && <> Нажмите «Создать».</>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </Form>

      <style>{`
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
        .table td { padding: 11px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: middle; }
        .table tbody tr:last-child td { border-bottom: none; }
        .table tbody tr:hover td { background: var(--color-muted-bg); }
        .logo-cell { width: 110px; }
        .logo { height: 28px; width: auto; max-width: 96px; object-fit: contain; display: block; }
        .name-link { color: inherit; text-decoration: none; }
        .name-link:hover { color: var(--color-accent); }
        .code { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: var(--radius-full); font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: var(--color-status-new); background: var(--color-status-new-bg); }
        .role { display: inline-flex; margin-right: 6px; padding: 2px 8px; border-radius: var(--radius-full); font-size: 11.5px; font-weight: 600; color: var(--color-accent); background: oklch(52% 0.14 42 / 0.1); white-space: nowrap; }
        .strong { font-weight: 600; }
        .muted { color: var(--color-muted); }
      `}</style>
    </>
  );
}
