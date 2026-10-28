import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteProductName, updateProductName } from "@/actions/product-names";
import { productGroupOptions } from "@/lib/products";
import ProductNameForm from "../../product-name-form";
import DeleteProductNameButton from "./delete-product-name-button";
import Form from "@/components/form/form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const record = await prisma.productName.findFirst({ where: { id, deletedAt: null }, select: { isGroup: true } });
  return { title: record?.isGroup ? "Редактирование группы наименований" : "Редактирование наименования товара" };
}

export default async function EditProductNamePage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/product-names");

  const productName = await prisma.productName.findFirst({
    where: { id, deletedAt: null },
  });

  if (!productName) notFound();

  // группу нельзя положить в саму себя и в свои подгруппы
  const groups = await productGroupOptions(productName.isGroup ? id : undefined);
  const action = updateProductName.bind(null, id);

  return (
    <Form
      formKey="product-name-edit"
      title={
        productName.isGroup
          ? `Редактирование группы: ${productName.nameRu}`
          : `Редактирование наименования товара: ${productName.code}`
      }
      guid={productName.id}
      commands={
        <span data-command="remove" data-label="Удалить">
          <DeleteProductNameButton productNameId={id} deleteAction={deleteProductName} />
        </span>
      }
    >
      <ProductNameForm action={action} productName={productName} groups={groups} />
    </Form>
  );
}
