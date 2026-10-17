import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteProductName, updateProductName } from "@/actions/product-names";
import ProductNameForm from "../../product-name-form";
import DeleteProductNameButton from "./delete-product-name-button";
import Form from "@/components/form/form";

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
    <Form
      formKey="product-name-edit"
      title={`Редактирование наименования товара: ${productName.code}`}
      guid={productName.id}
      commands={
        <span data-command="remove" data-label="Удалить">
          <DeleteProductNameButton productNameId={id} deleteAction={deleteProductName} />
        </span>
      }
    >
      <ProductNameForm action={action} productName={productName} sections={sections} />
    </Form>
  );
}
