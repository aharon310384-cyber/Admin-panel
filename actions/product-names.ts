"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { productGroupPath } from "@/lib/products";
import { requireAdmin } from "@/lib/server-helpers";

const productNameSchema = z.object({
  code: z.string().trim().min(1, "Код обязателен"),
  nameRu: z.string().trim().min(1, "Наименование RU обязательно"),
  nameEn: z.string().trim().optional(),
  nameCn: z.string().trim().optional(),
  parentId: z.string().trim().optional(),
  hsCode: z
    .string()
    .trim()
    .regex(/^[0-9 .]*$/, "HS-код: только цифры, пробелы и точки")
    .optional(),
});

function productNamePayload(formData: FormData) {
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    nameRu: String(formData.get("nameRu") ?? "").trim(),
    nameEn: String(formData.get("nameEn") ?? "").trim(),
    nameCn: String(formData.get("nameCn") ?? "").trim(),
    parentId: String(formData.get("parentId") ?? "").trim(),
    hsCode: String(formData.get("hsCode") ?? "").trim(),
  };
}

/** Список, открытый на группе записи: после сохранения возвращаемся туда, откуда пришли. */
function listHref(parentId: string | null) {
  return parentId ? `/product-names?group=${parentId}` : "/product-names";
}

/** Группа, в которую кладётся запись: только группа справочника; группу нельзя вложить в себя и свои подгруппы. */
async function resolveParentGroup(
  parentId: string | undefined,
  selfId?: string
): Promise<{ parentId: string | null } | { error: string }> {
  if (!parentId) return { parentId: null };
  const path = await productGroupPath(parentId);
  if (!path.length) return { error: "Группа не найдена — выберите другую" };
  if (selfId && path.some((group) => group.id === selfId)) {
    return { error: "Группу нельзя положить в саму себя или в свою подгруппу" };
  }
  return { parentId };
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

  const { code, nameRu, nameEn, nameCn, parentId, hsCode } = parsed.data;
  const isGroup = formData.get("isGroup") === "1";
  if (await codeExists(code)) {
    return { error: { code: ["Такой код уже есть в регистре"] } };
  }

  const parent = await resolveParentGroup(parentId);
  if ("error" in parent) return { error: { parentId: [parent.error] } };

  await prisma.productName.create({
    data: {
      code,
      nameRu,
      nameEn: nameEn || null,
      nameCn: nameCn || null,
      isGroup,
      parentId: parent.parentId,
      hsCode: isGroup ? null : hsCode || null,
    },
  });

  revalidatePath("/product-names");
  redirect(listHref(parent.parentId));
}

export async function updateProductName(id: string, formData: FormData) {
  await requireAdmin();

  const parsed = productNameSchema.safeParse(productNamePayload(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { code, nameRu, nameEn, nameCn, parentId, hsCode } = parsed.data;
  const current = await prisma.productName.findFirst({
    where: { id, deletedAt: null },
    select: { isGroup: true, hsCode: true },
  });
  if (!current) return { error: { code: ["Запись удалена — откройте справочник заново"] } };
  if (await codeExists(code, id)) {
    return { error: { code: ["Такой код уже есть в регистре"] } };
  }

  const parent = await resolveParentGroup(parentId, id);
  if ("error" in parent) return { error: { parentId: [parent.error] } };

  const nextHsCode = current.isGroup ? null : hsCode || null;
  await prisma.productName.update({
    where: { id },
    data: {
      code,
      nameRu,
      nameEn: nameEn || null,
      nameCn: nameCn || null,
      parentId: parent.parentId,
      hsCode: nextHsCode,
      // официальное описание относится к прежнему HS-коду
      ...(nextHsCode !== current.hsCode && { hsDescription: null }),
    },
  });

  revalidatePath("/product-names");
  revalidatePath(`/product-names/${id}/edit`);
  redirect(listHref(parent.parentId));
}

export async function deleteProductName(id: string): Promise<{ error?: string } | void> {
  await requireAdmin();

  const record = await prisma.productName.findFirst({
    where: { id, deletedAt: null },
    select: { parentId: true, _count: { select: { children: { where: { deletedAt: null } } } } },
  });
  if (!record) return { error: "Запись уже удалена" };
  if (record._count.children > 0) {
    return { error: "В группе есть записи — сначала перенесите их в другую группу или удалите" };
  }

  await prisma.productName.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/product-names");
  redirect(listHref(record.parentId));
}
