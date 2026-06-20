"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";

const customerSchema = z.object({
  name: z.string().min(2, "Имя должно быть не короче 2 символов"),
  clientCode: z.string().optional(),
  lastName: z.string().optional(),
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  email: z.string().email("Некорректный email").optional().or(z.literal("")),
  phone: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
});

const parsedRecipientSchema = z.object({
  name: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  postalCode: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
});

async function findCountryByInput(input: string | null | undefined) {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return prisma.country.findUnique({ where: { code: trimmed.toUpperCase() } });
  }

  const lower = trimmed.toLowerCase();
  const countries = await prisma.country.findMany();
  return (
    countries.find(
      (c) => c.nameRu.toLowerCase() === lower || c.nameEn.toLowerCase() === lower
    ) ?? null
  );
}

const customerResolveSelect = {
  id: true,
  name: true,
  lastName: true,
  firstName: true,
  middleName: true,
  email: true,
  phone: true,
  code: true,
  clientCode: true,
  country: true,
  city: true,
  address: true,
} satisfies Prisma.CustomerSelect;

type ParsedRecipient = {
  name: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  postalCode: string | null;
  address: string | null;
};

type CustomerResolveRecord = Prisma.CustomerGetPayload<{
  select: typeof customerResolveSelect;
}>;

export type ResolvedCustomerOption = CustomerResolveRecord;

function compactText(value: string | null | undefined): string | null {
  const compacted = (value ?? "").replace(/\s+/g, " ").trim();
  return compacted || null;
}

function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`\u2019]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function normalizePostalCode(value: string | null | undefined): string {
  return normalizeIdentity(value).replace(/[\s-]/g, "");
}

function textTokens(value: string | null | undefined): string[] {
  return normalizeIdentity(value)
    .split(/[^a-zа-яё0-9]+/i)
    .filter((token) => token.length > 1);
}

function tokenOverlapScore(source: string | null, candidate: string | null, weight: number): number {
  const sourceTokens = textTokens(source);
  if (sourceTokens.length === 0) return 0;

  const candidateTokens = new Set(textTokens(candidate));
  if (candidateTokens.size === 0) return 0;

  const matched = sourceTokens.filter((token) => candidateTokens.has(token)).length;
  return Math.round((matched / sourceTokens.length) * weight);
}

function customerNameText(customer: CustomerResolveRecord): string {
  return [customer.name, customer.lastName, customer.firstName, customer.middleName]
    .filter(Boolean)
    .join(" ");
}

function customerAddressText(customer: CustomerResolveRecord): string {
  return [customer.address, customer.city, customer.country]
    .filter(Boolean)
    .join(" ");
}

function scoreCustomerMatch(
  recipient: ParsedRecipient,
  customer: CustomerResolveRecord
): { score: number; matchedBy: string } {
  let score = 0;
  const reasons: string[] = [];
  const recipientPhone = normalizePhone(recipient.phone);
  const customerPhone = normalizePhone(customer.phone);

  if (recipientPhone && customerPhone) {
    if (recipientPhone === customerPhone) {
      score += 120;
      reasons.push("телефону");
    } else if (recipientPhone.includes(customerPhone) || customerPhone.includes(recipientPhone)) {
      score += 90;
      reasons.push("похожему телефону");
    }
  }

  const nameScore = tokenOverlapScore(recipient.name, customerNameText(customer), 35);
  if (nameScore >= 18) {
    score += nameScore;
    reasons.push("имени");
  }

  if (
    recipient.city &&
    customer.city &&
    normalizeIdentity(recipient.city) === normalizeIdentity(customer.city)
  ) {
    score += 18;
    reasons.push("городу");
  }

  if (
    recipient.country &&
    customer.country &&
    normalizeIdentity(recipient.country) === normalizeIdentity(customer.country)
  ) {
    score += 12;
    reasons.push("стране");
  }

  const addressScore = tokenOverlapScore(recipient.address, customerAddressText(customer), 22);
  if (addressScore >= 10) {
    score += addressScore;
    reasons.push("адресу");
  }

  return { score, matchedBy: reasons.join(", ") || "похожим данным" };
}

function matchThreshold(recipient: ParsedRecipient): number {
  return normalizePhone(recipient.phone) ? 80 : 45;
}

function findBestCustomer(
  recipient: ParsedRecipient,
  customers: CustomerResolveRecord[]
): { customer: CustomerResolveRecord; matchedBy: string } | null {
  const best = customers
    .map((customer) => ({ customer, ...scoreCustomerMatch(recipient, customer) }))
    .sort((left, right) => right.score - left.score)[0];

  if (!best || best.score < matchThreshold(recipient)) return null;

  return { customer: best.customer, matchedBy: best.matchedBy };
}

function nameParts(name: string | null): {
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
} {
  const parts = (name ?? "").split(/\s+/).filter(Boolean);

  return {
    lastName: parts[0] ?? null,
    firstName: parts[1] ?? null,
    middleName: parts.slice(2).join(" ") || null,
  };
}

function parsedRecipientFromInput(input: unknown): ParsedRecipient | null {
  const parsed = parsedRecipientSchema.safeParse(input);
  if (!parsed.success) return null;

  const recipient: ParsedRecipient = {
    name: compactText(parsed.data.name),
    phone: compactText(parsed.data.phone),
    country: compactText(parsed.data.country),
    city: compactText(parsed.data.city),
    postalCode: compactText(parsed.data.postalCode),
    address: compactText(parsed.data.address),
  };

  return Object.values(recipient).some(Boolean) ? recipient : null;
}

export async function updateCustomer(id: string, formData: FormData) {
  await requireAdmin();

  const raw = {
    name: formData.get("name"),
    clientCode: formData.get("clientCode") || undefined,
    lastName: formData.get("lastName") || undefined,
    firstName: formData.get("firstName") || undefined,
    middleName: formData.get("middleName") || undefined,
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    country: formData.get("country") || undefined,
    city: formData.get("city") || undefined,
    address: formData.get("address") || undefined,
  };

  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const {
    name,
    clientCode,
    lastName,
    firstName,
    middleName,
    email,
    phone,
    country,
    city,
    address,
  } = parsed.data;

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      clientCode: clientCode ?? null,
      lastName: lastName ?? null,
      firstName: firstName ?? null,
      middleName: middleName ?? null,
      email: email || null,
      phone: phone ?? null,
      country: country ?? null,
      city: city ?? null,
      address: address ?? null,
    },
  });

  revalidatePath(`/recipients/${id}`);
  revalidatePath("/recipients");

  const returnTo = (formData.get("returnTo") as string | null)?.trim();
  redirect(safeReturnTo(returnTo, id) ?? `/recipients/${id}`);
}

function safeReturnTo(value: string | null | undefined, customerId: string): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.includes("//") || value.includes("\\")) return null;
  return value.replace("{customerId}", customerId);
}

export async function createCustomer(formData: FormData) {
  await requireAdmin();

  const raw = {
    name: formData.get("name"),
    clientCode: formData.get("clientCode") || undefined,
    lastName: formData.get("lastName") || undefined,
    firstName: formData.get("firstName") || undefined,
    middleName: formData.get("middleName") || undefined,
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    country: formData.get("country") || undefined,
    city: formData.get("city") || undefined,
    address: formData.get("address") || undefined,
  };

  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const {
    name,
    clientCode,
    lastName,
    firstName,
    middleName,
    email,
    phone,
    country,
    city,
    address,
  } = parsed.data;

  const customer = await prisma.customer.create({
    data: {
      name,
      clientCode: clientCode ?? null,
      lastName: lastName ?? null,
      firstName: firstName ?? null,
      middleName: middleName ?? null,
      email: email || null,
      phone: phone ?? null,
      country: country ?? null,
      city: city ?? null,
      address: address ?? null,
    },
  });

  revalidatePath("/recipients");

  const returnTo = (formData.get("returnTo") as string | null)?.trim();
  redirect(safeReturnTo(returnTo, customer.id) ?? `/recipients/${customer.id}`);
}

export async function deleteCustomer(id: string) {
  await requireAdmin();

  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/recipients");
  redirect("/recipients");
}

export async function resolveCustomerFromParsedRecipient(input: unknown): Promise<{
  customer: ResolvedCustomerOption;
  created: boolean;
  matchedBy: string;
}> {
  await requireAdmin();

  const recipient = parsedRecipientFromInput(input);
  if (!recipient) {
    throw new Error("Не удалось распознать данные получателя");
  }

  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    select: customerResolveSelect,
  });
  const matched = findBestCustomer(recipient, customers);

  if (matched) {
    return { customer: matched.customer, created: false, matchedBy: matched.matchedBy };
  }

  const fullName =
    recipient.name ??
    compactText([recipient.phone, recipient.city, recipient.country].filter(Boolean).join(", ")) ??
    "Получатель без имени";
  const parts = nameParts(recipient.name);
  const customer = await prisma.customer.create({
    data: {
      name: fullName,
      lastName: parts.lastName,
      firstName: parts.firstName,
      middleName: parts.middleName,
      phone: recipient.phone,
      country: recipient.country,
      city: recipient.city,
      address: recipient.address,
    },
    select: customerResolveSelect,
  });

  revalidatePath("/recipients");

  return { customer, created: true, matchedBy: "создан новый получатель" };
}
