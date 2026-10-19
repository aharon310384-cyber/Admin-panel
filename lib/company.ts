import "server-only";

import { cache } from "react";
import { connection } from "next/server";
import type { Company } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Brand, CompanyImage } from "@/lib/brand";

// Компании и их бренды. Админка показывает бренд компании-склада (adminBrand),
// кабинет клиента и Telegram — бренд компании клиентов (cabinetBrand).
// Пока компании не заполнены — нейтральное название без логотипа.

// Всё, кроме самих картинок: их отдаёт /api/company/[id]/[image].
export const COMPANY_FIELDS = {
  id: true,
  code: true,
  name: true,
  legalName: true,
  tagline: true,
  siteUrl: true,
  trackingUrl: true,
  phone: true,
  email: true,
  telegram: true,
  address: true,
  telegramGreeting: true,
  telegramSignature: true,
  logoType: true,
  iconType: true,
  adminBrand: true,
  cabinetBrand: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type CompanyView = Omit<Company, "logo" | "icon" | "updatedBy">;

/** Адрес картинки компании; меняется после каждого сохранения, чтобы браузер не показывал старую. */
export function companyImageUrl(company: Pick<CompanyView, "id" | "updatedAt" | "logoType" | "iconType">, image: CompanyImage) {
  const type = image === "logo" ? company.logoType : company.iconType;
  return type ? `/api/company/${company.id}/${image}?v=${company.updatedAt.getTime()}` : null;
}

function toBrand(company: CompanyView | null, fallbackName: string): Brand {
  if (!company) return { name: fallbackName, tagline: null, siteUrl: null, trackingUrl: null, logoUrl: null, iconUrl: null };
  return {
    name: company.name,
    tagline: company.tagline,
    siteUrl: company.siteUrl,
    trackingUrl: company.trackingUrl,
    logoUrl: companyImageUrl(company, "logo"),
    iconUrl: companyImageUrl(company, "icon"),
  };
}

// Страницы с брендом всегда собираются на запросе: бренд меняется в админке, а не при сборке.
const findAdminCompany = cache(async () => {
  await connection();
  return prisma.company.findFirst({ where: { adminBrand: true }, select: COMPANY_FIELDS, orderBy: { createdAt: "asc" } });
});

const findCabinetCompany = cache(async () => {
  await connection();
  return prisma.company.findFirst({ where: { cabinetBrand: true }, select: COMPANY_FIELDS, orderBy: { createdAt: "asc" } });
});

/** Бренд админки (склад). */
export async function getAdminBrand(): Promise<Brand> {
  return toBrand(await findAdminCompany(), "Админ-панель");
}

/** Значок вкладки браузера для админки и её входа: знак или буквы компании-склада, а не значок кабинета клиента. */
export async function adminTabIcon(): Promise<string> {
  const brand = await getAdminBrand();
  return `/api/company/admin-icon?v=${encodeURIComponent(`${brand.name}-${brand.iconUrl ?? ""}`)}`;
}

/** Бренд кабинета клиента. */
export async function getCabinetBrand(): Promise<Brand> {
  return toBrand(await findCabinetCompany(), "Личный кабинет");
}

/** Тексты Telegram от компании клиентов: приветствие бота и подпись под уведомлениями. */
export async function getTelegramTexts(): Promise<{ greeting: string; signature: string | null }> {
  const company = await prisma.company.findFirst({
    where: { cabinetBrand: true },
    select: { name: true, telegramGreeting: true, telegramSignature: true },
    orderBy: { createdAt: "asc" },
  });
  const greeting = company?.telegramGreeting?.trim() || (company ? `Здравствуйте! Это кабинет ${company.name}.` : "Здравствуйте!");
  return { greeting, signature: company?.telegramSignature?.trim() || null };
}
