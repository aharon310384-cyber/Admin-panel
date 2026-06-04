"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";

const productNameSchema = z.object({
  code: z.string().trim().min(1, "Код обязателен"),
  nameRu: z.string().trim().min(1, "Наименование RU обязательно"),
  nameEn: z.string().trim().optional(),
  nameCn: z.string().trim().optional(),
});

function productNamePayload(formData: FormData) {
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    nameRu: String(formData.get("nameRu") ?? "").trim(),
    nameEn: String(formData.get("nameEn") ?? "").trim(),
    nameCn: String(formData.get("nameCn") ?? "").trim(),
  };
}

async function codeExists(code: string, exceptId?: string): Promise<boolean> {
  const existing = await prisma.productName.findUnique({
    where: { code },
    select: { id: true },
  });

  return Boolean(existing && existing.id !== exceptId);
}

export async function createProductName(formData: FormData) {
  await requireAdmin();

  const parsed = productNameSchema.safeParse(productNamePayload(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { code, nameRu, nameEn, nameCn } = parsed.data;
  if (await codeExists(code)) {
    return { error: { code: ["Такой код уже есть в регистре"] } };
  }

  await prisma.productName.create({
    data: {
      code,
      nameRu,
      nameEn: nameEn || null,
      nameCn: nameCn || null,
    },
  });

  revalidatePath("/product-names");
  redirect("/product-names");
}

export async function updateProductName(id: string, formData: FormData) {
  await requireAdmin();

  const parsed = productNameSchema.safeParse(productNamePayload(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { code, nameRu, nameEn, nameCn } = parsed.data;
  if (await codeExists(code, id)) {
    return { error: { code: ["Такой код уже есть в регистре"] } };
  }

  await prisma.productName.update({
    where: { id },
    data: {
      code,
      nameRu,
      nameEn: nameEn || null,
      nameCn: nameCn || null,
      deletedAt: null,
    },
  });

  revalidatePath("/product-names");
  revalidatePath(`/product-names/${id}/edit`);
  redirect("/product-names");
}

export async function deleteProductName(id: string) {
  await requireAdmin();

  await prisma.productName.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/product-names");
  redirect("/product-names");
}
