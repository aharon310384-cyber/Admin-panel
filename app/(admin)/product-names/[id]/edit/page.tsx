import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteProductName, updateProductName } from "@/actions/product-names";
import ProductNameForm from "../../product-name-form";
import DeleteProductNameButton from "./delete-product-name-button";

export const metadata: Metadata = { title: "Редактирование наименования товара" };

export default async function EditProductNamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/product-names");

  const [productName, sections] = await Promise.all([
    prisma.productName.findFirst({
      where: { id, deletedAt: null },
    }),
    prisma.productName.findMany({
      where: { deletedAt: null, parentId: null },
      select: { id: true, code: true, nameRu: true },
      orderBy: { code: "asc" },
    }),
  ]);

  if (!productName) notFound();

  const action = updateProductName.bind(null, id);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/product-names" className="breadcrumb-link">
              Наименования товаров
            </Link>
            <span className="breadcrumb-sep">/</span>
            <span>{productName.code}</span>
          </div>
          <h1 className="page-title">Редактирование наименования товара</h1>
        </div>
        <DeleteProductNameButton productNameId={id} deleteAction={deleteProductName} />
      </div>

      <ProductNameForm action={action} productName={productName} sections={sections} />

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
