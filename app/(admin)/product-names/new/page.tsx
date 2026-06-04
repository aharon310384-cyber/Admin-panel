import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createProductName } from "@/actions/product-names";
import ProductNameForm from "../product-name-form";

export const metadata: Metadata = { title: "Новое наименование товара" };

export default async function NewProductNamePage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/product-names");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/product-names" className="breadcrumb-link">
              Наименования товаров
            </Link>
            <span className="breadcrumb-sep">/</span>
            <span>Новая запись</span>
          </div>
          <h1 className="page-title">Новое наименование товара</h1>
        </div>
      </div>

      <ProductNameForm action={createProductName} />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-link:hover { text-decoration: underline; }
        .breadcrumb-sep { color: var(--color-border-strong); }
      `}</style>
    </div>
  );
}
