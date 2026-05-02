"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const customerSchema = z.object({
  name: z.string().min(2, "Имя должно быть не короче 2 символов"),
  email: z.string().email("Некорректный email").optional().or(z.literal("")),
  phone: z.string().optional(),
  username: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Нет доступа");
  }
  return session;
}

export async function updateCustomer(id: string, formData: FormData) {
  await requireAdmin();

  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    username: formData.get("username") || undefined,
    country: formData.get("country") || undefined,
    city: formData.get("city") || undefined,
    address: formData.get("address") || undefined,
  };

  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, email, phone, username, country, city, address } = parsed.data;

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      email: email || null,
      phone: phone ?? null,
      username: username ?? null,
      country: country ?? null,
      city: city ?? null,
      address: address ?? null,
    },
  });

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  await requireAdmin();

  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/customers");
  redirect("/customers");
}
