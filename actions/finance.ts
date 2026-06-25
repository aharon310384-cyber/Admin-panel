"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";

const financeSchema = z.object({
  exchangeRateCnyPerUsd: z.coerce
    .number()
    .positive("Курс должен быть больше 0"),
  exchangeRateUsdPerEur: z.coerce
    .number()
    .positive("Курс EUR должен быть больше 0"),
  euDutyEnabled: z.coerce.boolean(),
  euDutyPassToClient: z.coerce.boolean(),
});

export async function updateFinanceSettings(formData: FormData) {
  const session = await requireAdmin();

  const parsed = financeSchema.safeParse({
    exchangeRateCnyPerUsd: formData.get("exchangeRateCnyPerUsd"),
    exchangeRateUsdPerEur: formData.get("exchangeRateUsdPerEur"),
    euDutyEnabled: formData.get("euDutyEnabled") === "on",
    euDutyPassToClient: formData.get("euDutyPassToClient") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.financeSettings.findFirst();
  if (existing) {
    await prisma.financeSettings.update({
      where: { id: existing.id },
      data: {
        ...parsed.data,
        updatedBy: session.user.id,
      },
    });
  } else {
    await prisma.financeSettings.create({
      data: {
        ...parsed.data,
        updatedBy: session.user.id,
      },
    });
  }

  revalidatePath("/finance");
  return { ok: true as const };
}
