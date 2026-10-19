"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";

// «Логистика → Тарифы»: тарифы доставки (создать, изменить, удалить) и цены услуг (изменить).
// Как считается услуга (за кг, за заказ, %) — свойство программы, здесь меняются название, описание и цена.

export type TariffFormState = { error?: Record<string, string[] | undefined>; ok?: boolean };

const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, "е");

/** «Германия, Франция, US» → ["DE", "FR", "US"]; по коду, русскому или английскому названию и другим названиям страны. */
async function parseCountries(text: string): Promise<{ codes: string[]; unknown: string[] }> {
  const tokens = text.split(/[,;\n]+/).map((token) => token.trim()).filter(Boolean);
  if (!tokens.length) return { codes: [], unknown: [] };
  const countries = await prisma.country.findMany({ select: { code: true, nameRu: true, nameEn: true, aliases: true } });
  const byName = new Map<string, string>();
  for (const country of countries) {
    for (const name of [country.code, country.nameRu, country.nameEn, ...(country.aliases?.split(",") ?? [])]) {
      if (name.trim()) byName.set(normalize(name), country.code);
    }
  }
  const codes: string[] = [];
  const unknown: string[] = [];
  for (const token of tokens) {
    const code = byName.get(normalize(token));
    if (!code) unknown.push(token);
    else if (!codes.includes(code)) codes.push(code);
  }
  return { codes, unknown };
}

const text = (max: number) =>
  z.string().trim().max(max, `Не длиннее ${max} знаков`).transform((value) => value || null);

const money = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .pipe(z.coerce.number({ invalid_type_error: "Число" }).min(0, "Не меньше 0").max(100000, "Слишком много"));

const optionalInt = (label: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || (Number.isInteger(value) && value >= 0), `${label}: целое число не меньше 0`);

const shippingSchema = z
  .object({
    companyId: z.string().min(1, "Выберите компанию"),
    section: text(60),
    direction: z.string().trim().min(1, "Укажите направление").max(120, "Не длиннее 120 знаков"),
    deliveryType: z.string().min(1, "Выберите вид доставки"),
    cargoType: text(120),
    deliveryTarget: text(120),
    pricePerKgUsd: money,
    handlingFeeUsd: money,
    minDays: optionalInt("Срок"),
    maxDays: optionalInt("Срок"),
    volumetricDivisor: optionalInt("Делитель").refine((value) => value !== 0, "Делитель больше 0"),
    sortOrder: optionalInt("Порядок").transform((value) => value ?? 0),
    paymentTiming: z.enum(["BEFORE", "FLEXIBLE"]),
    onRequest: z.boolean(),
    active: z.boolean(),
  })
  .refine((data) => data.minDays == null || data.maxDays == null || data.minDays <= data.maxDays, {
    path: ["maxDays"],
    message: "«До» не меньше «от»",
  });

async function readShipping(formData: FormData) {
  const value = (key: string) => String(formData.get(key) ?? "");
  const parsed = shippingSchema.safeParse({
    companyId: value("companyId"),
    section: value("section"),
    direction: value("direction"),
    deliveryType: value("deliveryType"),
    cargoType: value("cargoType"),
    deliveryTarget: value("deliveryTarget"),
    pricePerKgUsd: value("pricePerKgUsd") || "0",
    handlingFeeUsd: value("handlingFeeUsd") || "0",
    minDays: value("minDays"),
    maxDays: value("maxDays"),
    volumetricDivisor: value("volumetricDivisor"),
    sortOrder: value("sortOrder"),
    paymentTiming: value("paymentTiming"),
    onRequest: formData.get("onRequest") === "on",
    active: formData.get("active") === "on",
  });
  const countries = await parseCountries(value("countries"));
  const errors: Record<string, string[] | undefined> = parsed.success ? {} : parsed.error.flatten().fieldErrors;
  if (countries.unknown.length) errors.countries = [`Не нашли в справочнике стран: ${countries.unknown.join(", ")}`];
  if (parsed.success) {
    const [company, method] = await Promise.all([
      prisma.company.findUnique({ where: { id: parsed.data.companyId }, select: { id: true } }),
      prisma.deliveryMethod.findUnique({ where: { code: parsed.data.deliveryType }, select: { code: true } }),
    ]);
    if (!company) errors.companyId = ["Компания не найдена"];
    if (!method) errors.deliveryType = ["Вид доставки не найден"];
  }
  if (!parsed.success || Object.keys(errors).length) return { error: errors } as const;
  return { data: { ...parsed.data, countryCodes: countries.codes } } as const;
}

function revalidateTariffs() {
  revalidatePath("/tariffs", "layout");
  revalidatePath("/cabinet/tariffs");
}

export async function createShippingTariff(_state: TariffFormState, formData: FormData): Promise<TariffFormState> {
  await requireAdmin();
  const result = await readShipping(formData);
  if ("error" in result) return { error: result.error };
  const tariff = await prisma.shippingTariff.create({ data: result.data });
  revalidateTariffs();
  redirect(`/tariffs/${tariff.id}`);
}

export async function updateShippingTariff(id: string, _state: TariffFormState, formData: FormData): Promise<TariffFormState> {
  await requireAdmin();
  const result = await readShipping(formData);
  if ("error" in result) return { error: result.error };
  const updated = await prisma.shippingTariff.updateMany({ where: { id }, data: result.data });
  if (!updated.count) return { error: { direction: ["Тариф не найден — обновите страницу"] } };
  revalidateTariffs();
  return { ok: true };
}

export async function deleteShippingTariff(id: string): Promise<void> {
  await requireAdmin();
  await prisma.shippingTariff.deleteMany({ where: { id } });
  revalidateTariffs();
  redirect("/tariffs");
}

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(120, "Не длиннее 120 знаков"),
  description: text(500),
  value: money,
  percentMin: money,
  percentMax: money,
  sortOrder: optionalInt("Порядок").transform((value) => value ?? 0),
  inPriceList: z.boolean(),
  active: z.boolean(),
});

export async function updateServiceTariff(code: string, _state: TariffFormState, formData: FormData): Promise<TariffFormState> {
  await requireAdmin();
  const service = await prisma.serviceTariff.findUnique({ where: { code }, select: { pricingType: true } });
  if (!service) return { error: { name: ["Услуга не найдена — обновите страницу"] } };

  const value = (key: string) => String(formData.get(key) ?? "");
  const parsed = serviceSchema.safeParse({
    name: value("name"),
    description: value("description"),
    value: value("value") || "0",
    percentMin: value("percentMin") || "0",
    percentMax: value("percentMax") || "0",
    sortOrder: value("sortOrder"),
    inPriceList: formData.get("inPriceList") === "on",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };
  const { percentMin, percentMax, value: price, ...rest } = parsed.data;
  if (service.pricingType === "PERCENT" && percentMin > percentMax) return { error: { percentMax: ["«До» не меньше «от»"] } };

  // Сохраняются только цены, которые нужны способу расчёта услуги.
  const prices =
    service.pricingType === "PERCENT"
      ? { value: null, percentMin, percentMax }
      : service.pricingType === "MANUAL"
        ? { value: null, percentMin: null, percentMax: null }
        : { value: price, percentMin: null, percentMax: null };
  await prisma.serviceTariff.update({ where: { code }, data: { ...rest, ...prices } });
  revalidateTariffs();
  return { ok: true };
}
