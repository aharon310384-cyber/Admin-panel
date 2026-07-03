"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";

const recipientSchema = z.object({
  customerId: z.string().min(1, "Выберите клиента-владельца"),
  lastName: z.string().min(1, "Укажите фамилию"),
  firstName: z.string().min(1, "Укажите имя"),
  middleName: z.string().optional(),
  phone: z.string().optional(),
  phoneDialCode: z
    .string()
    .regex(/^\+\d{1,4}$/, "Телефонный код в формате +7")
    .optional()
    .or(z.literal("")),
  countryCode: z
    .string()
    .regex(/^[A-Za-z]{2}$/, "Код страны — 2 буквы")
    .optional()
    .or(z.literal("")),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  passportSeries: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
    .optional()
    .or(z.literal("")),
  pinfl: z
    .string()
    .regex(/^\d{14}$/, "PINFL — 14 цифр")
    .optional()
    .or(z.literal("")),
});

function str(v: FormDataEntryValue | null): string | undefined {
  const s = (v as string | null)?.trim();
  return s ? s : undefined;
}

function readForm(formData: FormData) {
  return {
    customerId: (formData.get("customerId") as string | null)?.trim() ?? "",
    lastName: str(formData.get("lastName")) ?? "",
    firstName: str(formData.get("firstName")) ?? "",
    middleName: str(formData.get("middleName")),
    phone: str(formData.get("phone")),
    phoneDialCode: str(formData.get("phoneDialCode")),
    countryCode: str(formData.get("countryCode"))?.toUpperCase(),
    country: str(formData.get("country")),
    city: str(formData.get("city")),
    address: str(formData.get("address")),
    postalCode: str(formData.get("postalCode")),
    passportSeries: str(formData.get("passportSeries")),
    passportNumber: str(formData.get("passportNumber")),
    passportExpiry: str(formData.get("passportExpiry")),
    pinfl: str(formData.get("pinfl")),
  };
}

function composeName(parsed: z.infer<typeof recipientSchema>): string {
  return [parsed.lastName, parsed.firstName, parsed.middleName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function toData(parsed: z.infer<typeof recipientSchema>) {
  const countryCode = parsed.countryCode ? parsed.countryCode.toUpperCase() : null;
  return {
    name: composeName(parsed),
    firstName: parsed.firstName ?? null,
    lastName: parsed.lastName ?? null,
    middleName: parsed.middleName ?? null,
    phone: parsed.phone ?? null,
    phoneDialCode: parsed.phoneDialCode || null,
    countryCode,
    country: parsed.country ?? null,
    city: parsed.city ?? null,
    address: parsed.address ?? null,
    postalCode: parsed.postalCode ?? null,
    passportSeries: parsed.passportSeries ?? null,
    passportNumber: parsed.passportNumber ?? null,
    passportExpiry: parsed.passportExpiry ? new Date(parsed.passportExpiry) : null,
    pinfl: parsed.pinfl || null,
  };
}

function safeReturnTo(value: string | null | undefined, recipientId: string): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.includes("//") || value.includes("\\")) return null;
  return value.replace("{recipientId}", recipientId).replace("{id}", recipientId);
}

export async function createRecipient(formData: FormData) {
  const session = await requireAdmin();

  const parsed = recipientSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const owner = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, deletedAt: null },
    select: { id: true },
  });
  if (!owner) {
    return { error: { customerId: ["Клиент-владелец не найден"] } };
  }

  const recipient = await prisma.recipient.create({
    data: { customerId: owner.id, authorId: session.user.id, ...toData(parsed.data) },
  });

  revalidatePath("/recipients");

  const returnTo = (formData.get("returnTo") as string | null)?.trim();
  redirect(safeReturnTo(returnTo, recipient.id) ?? `/recipients/${recipient.id}`);
}

export async function updateRecipient(id: string, formData: FormData) {
  await requireAdmin();

  const parsed = recipientSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const owner = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, deletedAt: null },
    select: { id: true },
  });
  if (!owner) {
    return { error: { customerId: ["Клиент-владелец не найден"] } };
  }

  await prisma.recipient.update({
    where: { id },
    data: { customerId: owner.id, ...toData(parsed.data) },
  });

  revalidatePath(`/recipients/${id}`);
  revalidatePath("/recipients");

  const returnTo = (formData.get("returnTo") as string | null)?.trim();
  redirect(safeReturnTo(returnTo, id) ?? `/recipients/${id}`);
}

export async function deleteRecipient(id: string) {
  await requireAdmin();

  await prisma.recipient.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/recipients");
  redirect("/recipients");
}
