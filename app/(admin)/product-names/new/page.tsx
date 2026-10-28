import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createProductName } from "@/actions/product-names";
import { productGroupOptions } from "@/lib/products";
import ProductNameForm from "../product-name-form";
import Form from "@/components/form/form";

type Props = { searchParams: Promise<{ type?: string; parent?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { type } = await searchParams;
  return { title: type === "group" ? "Новая группа наименований" : "Новое наименование товара" };
}

export default async function NewProductNamePage({ searchParams }: Props) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/product-names");

  const { type, parent } = await searchParams;
  const isGroup = type === "group";
  const groups = await productGroupOptions();
  // новая запись — в группе, которая открыта в списке
  const defaultParentId = groups.some((group) => group.id === parent) ? parent : undefined;

  return (
    <Form
      formKey={isGroup ? "product-group-new" : "product-name-new"}
      title={isGroup ? "Новая группа наименований" : "Новое наименование товара"}
    >
      <ProductNameForm
        action={createProductName}
        isGroup={isGroup}
        groups={groups}
        defaultParentId={defaultParentId}
      />
    </Form>
  );
}
