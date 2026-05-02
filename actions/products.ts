"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const productSchema = z.object({
  name: z.string().min(2, "Название должно быть не короче 2 символов"),
  slug: z.string().optional(),
  sku: z.string().min(1, "Код обязателен"),
  description: z.string().optional(),
  price: z.coerce.number().positive("Тариф должен быть больше 0"),
  stock: z.coerce.number().int().min(0, "Лимит не может быть отрицательным"),
  isActive: z.coerce.boolean().default(true),
  imageUrl: z.string().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Нет доступа");
  }
  return session;
}

export async function createProduct(formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData);
  const parsed = productSchema.safeParse({
    ...raw,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, slug, sku, description, price, stock, isActive, imageUrl } =
    parsed.data;

  const finalSlug = slug?.trim() || slugify(name);

  await prisma.product.create({
    data: {
      name,
      slug: finalSlug,
      sku,
      description,
      price,
      stock,
      isActive,
      imageUrl,
    },
  });

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();

  const raw = Object.fromEntries(formData);
  const parsed = productSchema.safeParse({
    ...raw,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, slug, sku, description, price, stock, isActive, imageUrl } =
    parsed.data;

  const finalSlug = slug?.trim() || slugify(name);

  await prisma.product.update({
    where: { id },
    data: { name, slug: finalSlug, sku, description, price, stock, isActive, imageUrl },
  });

  revalidatePath(`/products/${id}/edit`);
  revalidatePath("/products");
  redirect("/products");
}

export async function archiveProduct(id: string) {
  await requireAdmin();

  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath("/products");
}

export async function deleteProduct(id: string) {
  await requireAdmin();

  const hasOrders = await prisma.orderItem.findFirst({
    where: { productId: id },
  });

  if (hasOrders) {
    return {
      error: "Нельзя удалить услугу, которая уже используется в заказах. Используйте архивирование.",
    };
  }

  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/products");
  redirect("/products");
}
