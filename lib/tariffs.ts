import "server-only";

import type { Prisma, PrismaClient, ServiceTariff } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatServicePrice, type ServiceHints } from "@/lib/tariff-format";

// Тарифы доставки и цены услуг — только из базы («Логистика → Тарифы»), не из кода.

type Db = PrismaClient | Prisma.TransactionClient;

/** Компания, чьи тарифы действуют для клиентов. Пока у клиента нет своей компании — компания кабинета. */
export async function clientCompanyId(db: Db = prisma): Promise<string | null> {
  const company = await db.company.findFirst({ where: { cabinetBrand: true }, select: { id: true }, orderBy: { createdAt: "asc" } });
  return company?.id ?? null;
}

/** Тариф посылки: по стране получателя и виду доставки среди действующих тарифов компании клиентов. */
export async function findShippingTariff(countryCode: string | null | undefined, deliveryType: string | null | undefined, db: Db = prisma) {
  if (!countryCode || !deliveryType) return null;
  const companyId = await clientCompanyId(db);
  if (!companyId) return null;
  return db.shippingTariff.findFirst({
    where: { companyId, active: true, onRequest: false, deliveryType, countryCodes: { has: countryCode.toUpperCase() } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Виды доставки по странам из действующих тарифов: «US» → ["AIR"]. Для подстановки вида доставки в заказ. */
export async function deliveryTypesByCountry(): Promise<Record<string, string[]>> {
  const companyId = await clientCompanyId();
  if (!companyId) return {};
  const tariffs = await prisma.shippingTariff.findMany({
    where: { companyId, active: true, onRequest: false },
    select: { countryCodes: true, deliveryType: true },
  });
  const byCountry: Record<string, string[]> = {};
  for (const tariff of tariffs) {
    for (const code of tariff.countryCodes) {
      const types = (byCountry[code] ??= []);
      if (!types.includes(tariff.deliveryType)) types.push(tariff.deliveryType);
    }
  }
  return byCountry;
}

/** Действующие услуги по коду: название и цена для расчёта посылки. */
export async function activeServices(db: Db = prisma): Promise<Map<string, ServiceTariff>> {
  const services = await db.serviceTariff.findMany({ where: { active: true } });
  return new Map(services.map((service) => [service.code, service]));
}

/** Подсказки цен к отметкам услуг в формах заказа и посылки: код → «0.3$/кг». */
export async function serviceHints(): Promise<ServiceHints> {
  const services = await prisma.serviceTariff.findMany({ where: { active: true } });
  return Object.fromEntries(services.map((service) => [service.code, formatServicePrice(service)]));
}

/** Тарифы компании для страниц тарифов, по порядку. */
export async function companyTariffs(companyId: string, options: { activeOnly?: boolean } = {}) {
  const active = options.activeOnly ? { active: true } : {};
  const [shipping, services] = await Promise.all([
    prisma.shippingTariff.findMany({
      where: { companyId, ...active },
      include: { deliveryMethod: { select: { nameRu: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.serviceTariff.findMany({
      where: { companyId, ...active, ...(options.activeOnly ? { inPriceList: true } : {}) },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
  ]);
  return { shipping, services };
}

/** Разделы страницы тарифов в порядке первого тарифа раздела. */
export function groupBySection<T extends { section: string | null }>(rows: T[]): { section: string; rows: T[] }[] {
  const groups: { section: string; rows: T[] }[] = [];
  for (const row of rows) {
    const section = row.section?.trim() || "Тарифы";
    const group = groups.find((item) => item.section === section);
    if (group) group.rows.push(row);
    else groups.push({ section, rows: [row] });
  }
  return groups;
}

/** Названия стран по кодам — для списка стран направления. */
export async function countryNames(): Promise<Map<string, string>> {
  const countries = await prisma.country.findMany({ select: { code: true, nameRu: true } });
  return new Map(countries.map((country) => [country.code, country.nameRu]));
}

/** Выбор в карточке тарифа: компании, виды доставки, уже заведённые разделы. */
export async function tariffFormOptions() {
  const [companies, methods, sections] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.deliveryMethod.findMany({ where: { active: true }, select: { code: true, nameRu: true }, orderBy: { sortOrder: "asc" } }),
    prisma.shippingTariff.findMany({ where: { section: { not: null } }, select: { section: true }, distinct: ["section"] }),
  ]);
  return {
    companies: companies.map((company) => ({ value: company.id, label: company.name })),
    deliveryMethods: methods.map((method) => ({ value: method.code, label: method.nameRu })),
    sections: sections.map((row) => row.section!).filter(Boolean),
  };
}
