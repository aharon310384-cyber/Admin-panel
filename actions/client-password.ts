"use server";

import { auth } from "@/auth";
import { setClientPassword, generatePassword } from "@/lib/client-auth";

/**
 * Генерирует и сохраняет новый пароль клиента (только ADMIN).
 * Возвращает сгенерированный пароль для разового показа сотруднику.
 */
export async function resetClientPassword(
  customerId: string
): Promise<{ ok: boolean; password?: string }> {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return { ok: false };

  const password = generatePassword();
  await setClientPassword(customerId, password);
  return { ok: true, password };
}
