import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProductForm from "../../product-form";
import { updateProduct, archiveProduct, deleteProduct } from "@/actions/products";
import DeleteProductButton from "./delete-product-button";

export const metadata: Metadata = { title: "Редактирование услуги" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/products");

  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
  });

  if (!product) notFound();

  const update = updateProduct.bind(null, id);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/products" className="breadcrumb-link">Услуги</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{product.name}</span>
          </div>
          <h1 className="page-title">Редактирование услуги</h1>
        </div>
        <div className="header-actions">
          {product.isActive && (
            <form action={archiveProduct.bind(null, id)}>
              <button type="submit" className="btn-warning">
                Архивировать
              </button>
            </form>
          )}
          <DeleteProductButton productId={id} deleteAction={deleteProduct} />
        </div>
      </div>

      <ProductForm action={update} product={product} />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-muted); margin-bottom: 4px; }
        .breadcrumb-link { color: var(--color-accent); text-decoration: none; }
        .breadcrumb-sep { color: var(--color-border-strong); }

        .header-actions { display: flex; gap: 8px; align-items: center; }

        .btn-warning { padding: 9px 14px; background: transparent; border: 1px solid var(--color-warning); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-warning); cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; }
        .btn-warning:hover { background: var(--color-warning-bg); }
      `}</style>
    </div>
  );
}
