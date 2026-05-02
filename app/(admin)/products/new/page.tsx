import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ProductForm from "../product-form";
import { createProduct } from "@/actions/products";

export const metadata: Metadata = { title: "Новая услуга" };

export default async function NewProductPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/products");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/products" className="breadcrumb-link">Услуги</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Новая услуга</span>
          </div>
          <h1 className="page-title">Новая услуга</h1>
        </div>
      </div>

      <ProductForm action={createProduct} />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-sep { color: var(--color-border-strong); }
      `}</style>
    </div>
  );
}
