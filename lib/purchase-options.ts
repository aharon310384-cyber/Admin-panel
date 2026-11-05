import "server-only";

import { prisma } from "@/lib/prisma";
import { deliveryTypesByCountry, serviceHints } from "@/lib/tariffs";

// Варианты для форм покупки (корзина клиента, цена менеджера): страны, виды доставки по тарифам, получатели клиента,
// названия и цены услуг. Всё — из справочников и тарифов в базе.

export const PURCHASE_SERVICE_FIELDS = [
  { field: "consolidationRequested", code: "CONSOLIDATION", fallback: "Консолидация", turnkeyOnly: true },
  { field: "compactPackRequested", code: "COMPACT_PACK", fallback: "Компактная упаковка", turnkeyOnly: true },
  { field: "standardCheckRequested", code: "STANDARD_CHECK", fallback: "Стандартная проверка", turnkeyOnly: false },
  { field: "detailedCheckRequested", code: "DETAILED_CHECK", fallback: "Детальная проверка и фотоотчёт", turnkeyOnly: false },
  { field: "reinforcedPackRequested", code: "REINFORCED_PACK", fallback: "Усиленная упаковка", turnkeyOnly: true },
  { field: "keepOriginalPackaging", code: "KEEP_ORIGINAL_PACK", fallback: "Оставить оригинальную упаковку", turnkeyOnly: false },
] as const;

export type PurchaseServiceField = (typeof PURCHASE_SERVICE_FIELDS)[number]["field"];

export type PurchaseFormOptions = {
  countries: { code: string; name: string; withTariff: boolean }[];
  deliveryMethods: { code: string; name: string }[];
  typesByCountry: Record<string, string[]>;
  services: { field: PurchaseServiceField; name: string; price: string; turnkeyOnly: boolean }[];
  recipients: { id: string; name: string; countryCode: string | null; city: string | null }[];
};

export async function purchaseFormOptions(customerId: string): Promise<PurchaseFormOptions> {
  const [countries, methods, typesByCountry, hints, recipients] = await Promise.all([
    prisma.country.findMany({ select: { code: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
    prisma.deliveryMethod.findMany({ where: { active: true }, select: { code: true, nameRu: true }, orderBy: { sortOrder: "asc" } }),
    deliveryTypesByCountry(),
    serviceHints(),
    prisma.recipient.findMany({
      where: { customerId, deletedAt: null },
      select: { id: true, name: true, countryCode: true, city: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const withTariff = new Set(Object.keys(typesByCountry));
  // страны с тарифами — сверху: туда возим чаще
  const sorted = [...countries].sort((a, b) => Number(withTariff.has(b.code)) - Number(withTariff.has(a.code)));
  return {
    countries: sorted.map((c) => ({ code: c.code, name: c.nameRu, withTariff: withTariff.has(c.code) })),
    deliveryMethods: methods.map((m) => ({ code: m.code, name: m.nameRu })),
    typesByCountry,
    services: PURCHASE_SERVICE_FIELDS.filter((s) => hints[s.code]).map((s) => ({
      field: s.field,
      name: hints[s.code]?.name ?? s.fallback,
      price: hints[s.code]?.price ?? "",
      turnkeyOnly: s.turnkeyOnly,
    })),
    recipients,
  };
}
