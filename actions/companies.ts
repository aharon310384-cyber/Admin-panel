"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";

// «Администрирование → Компании»: название, сайт, цвета, контакты, тексты Telegram и чей бренд где показывается.
// Логотип и знак загружаются отдельно — /api/company/[id]/[image].

export type CompanyFormState = { error?: Record<string, string[] | undefined>; ok?: boolean };

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const text = (max: number) =>
  z.string().trim().max(max, `Не длиннее ${max} знаков`).transform((value) => value || null);

const link = z
  .string()
  .trim()
  .max(500, "Не длиннее 500 знаков")
  .refine((value) => !value || isHttpUrl(value), "Полный адрес, начиная с https://")
  .transform((value) => value || null);

// Цвет вида #1A2B3C (можно #ABC или без #). Пусто — стандартный вид.
const color = z
  .string()
  .trim()
  .transform((value) => value.replace(/^#?/, "#").toUpperCase())
  .transform((value) => (/^#[0-9A-F]{3}$/.test(value) ? value.replace(/[0-9A-F]/g, (c) => c + c) : value))
  .refine((value) => value === "#" || /^#[0-9A-F]{6}$/.test(value), "Цвет вида #1A2B3C")
  .transform((value) => (value === "#" ? "" : value));

const companySchema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(80, "Не длиннее 80 знаков"),
  legalName: text(200),
  tagline: text(120),
  siteUrl: link,
  trackingUrl: link,
  tariffsUrl: link,
  phone: text(60),
  email: z
    .string()
    .trim()
    .refine((value) => !value || z.string().email().safeParse(value).success, "Неверный email")
    .transform((value) => value || null),
  telegram: text(100),
  address: text(300),
  telegramGreeting: text(500),
  telegramSignature: text(200),
  primaryColor: color,
  accentColor: color,
  adminBrand: z.boolean(),
  cabinetBrand: z.boolean(),
});

const codeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z][A-Z0-9_]{1,29}$/, "Латинские буквы, цифры и _, от 2 до 30 знаков, первая — буква"));

function readForm(formData: FormData) {
  const value = (key: string) => String(formData.get(key) ?? "");
  return companySchema.safeParse({
    name: value("name"),
    legalName: value("legalName"),
    tagline: value("tagline"),
    siteUrl: value("siteUrl"),
    trackingUrl: value("trackingUrl"),
    tariffsUrl: value("tariffsUrl"),
    phone: value("phone"),
    email: value("email"),
    telegram: value("telegram"),
    address: value("address"),
    telegramGreeting: value("telegramGreeting"),
    telegramSignature: value("telegramSignature"),
    primaryColor: value("primaryColor"),
    accentColor: value("accentColor"),
    adminBrand: formData.get("adminBrand") === "on",
    cabinetBrand: formData.get("cabinetBrand") === "on",
  });
}

// Бренд админки и бренд кабинета — каждый только у одной компании: отмеченная снимает отметку с остальных.
async function clearOtherBrands(tx: Prisma.TransactionClient, id: string, data: { adminBrand: boolean; cabinetBrand: boolean }) {
  if (data.adminBrand) await tx.company.updateMany({ where: { id: { not: id }, adminBrand: true }, data: { adminBrand: false } });
  if (data.cabinetBrand) await tx.company.updateMany({ where: { id: { not: id }, cabinetBrand: true }, data: { cabinetBrand: false } });
}

export async function createCompany(_state: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const session = await requireAdmin();
  const parsed = readForm(formData);
  const code = codeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!parsed.success || !code.success) {
    return {
      error: {
        ...(parsed.success ? {} : parsed.error.flatten().fieldErrors),
        ...(code.success ? {} : { code: code.error.flatten().formErrors }),
      },
    };
  }
  if (await prisma.company.findUnique({ where: { code: code.data }, select: { id: true } })) {
    return { error: { code: ["Компания с таким кодом уже есть"] } };
  }

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({ data: { code: code.data, ...parsed.data, updatedBy: session.user.id } });
    await clearOtherBrands(tx, created.id, parsed.data);
    return created;
  });

  revalidatePath("/", "layout");
  redirect(`/companies/${company.id}`);
}

export async function updateCompany(id: string, _state: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const session = await requireAdmin();
  const parsed = readForm(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };
  if (!(await prisma.company.findUnique({ where: { id }, select: { id: true } }))) {
    return { error: { name: ["Компания не найдена — обновите страницу"] } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id }, data: { ...parsed.data, updatedBy: session.user.id } });
    await clearOtherBrands(tx, id, parsed.data);
  });

  // Бренд виден на всех страницах (шапка, вход, кабинет) — обновляем все.
  revalidatePath("/", "layout");
  return { ok: true };
}
