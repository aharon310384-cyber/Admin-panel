import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createProductName } from "@/actions/product-names";
import ProductNameForm from "../product-name-form";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Новое наименование товара" };

export default async function NewProductNamePage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/product-names");

  const sections = await prisma.productName.findMany({
    where: { deletedAt: null, parentId: null },
    select: { id: true, code: true, nameRu: true },
    orderBy: { code: "asc" },
  });

  return (
    <Form formKey="product-name-new" title="Новое наименование товара">
      <ProductNameForm action={createProductName} sections={sections} />
    </Form>
  );
}
