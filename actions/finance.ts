"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";

const financeSchema = z.object({
  exchangeRateCnyPerUsd: z.coerce
    .number()
    .positive("Курс должен быть больше 0"),
  exchangeRateCnyPerEur: z.coerce
    .number()
    .positive("Курс EUR должен быть больше 0"),
  euDutyEnabled: z.coerce.boolean(),
  euDutyPassToClient: z.coerce.boolean(),
});

export async function updateFinanceSettings(formData: FormData) {
  const session = await requireAdmin();

  const parsed = financeSchema.safeParse({
    exchangeRateCnyPerUsd: formData.get("exchangeRateCnyPerUsd"),
    exchangeRateCnyPerEur: formData.get("exchangeRateCnyPerEur"),
    euDutyEnabled: formData.get("euDutyEnabled") === "on",
    euDutyPassToClient: formData.get("euDutyPassToClient") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.financeSettings.findFirst();
    if (existing) {
      await tx.financeSettings.update({
        where: { id: existing.id },
        data: {
          ...parsed.data,
          updatedBy: session.user.id,
        },
      });
    } else {
      await tx.financeSettings.create({
        data: {
          ...parsed.data,
          updatedBy: session.user.id,
        },
      });
    }

    // Регистр курсов: поменявшийся курс — запись «было → стало», кто и когда
    const changes = [
      { currency: "USD" as const, oldRate: existing?.exchangeRateCnyPerUsd ?? null, newRate: parsed.data.exchangeRateCnyPerUsd },
      { currency: "EUR" as const, oldRate: existing?.exchangeRateCnyPerEur ?? null, newRate: parsed.data.exchangeRateCnyPerEur },
    ].filter((change) => change.oldRate == null || Number(change.oldRate) !== change.newRate);
    if (changes.length) {
      await tx.exchangeRateChange.createMany({
        data: changes.map((change) => ({ ...change, changedById: session.user.id })),
      });
    }
  });

  revalidatePath("/finance");
  return { ok: true as const };
}
