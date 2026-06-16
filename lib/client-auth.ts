import "server-only";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Customer } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Варианты кода клиента (регистр), как в кабинете. */
function codeVariants(code: string): string[] {
  const c = code.trim();
  return Array.from(new Set([c, c.toUpperCase(), c.toLowerCase()]));
}

/** Проверка входа клиента по коду и паролю. Возвращает клиента или null. */
export async function verifyClientPassword(
  code: string,
  password: string
): Promise<Customer | null> {
  if (!code?.trim() || !password) return null;

  const customer = await prisma.customer.findFirst({
    where: { code: { in: codeVariants(code) }, deletedAt: null },
  });
  if (!customer?.passwordHash) return null;

  const ok = await bcrypt.compare(password, customer.passwordHash);
  return ok ? customer : null;
}

/** Устанавливает (хеширует) пароль клиента. */
export async function setClientPassword(customerId: string, password: string): Promise<void> {
  const hash = await bcrypt.hash(password, 10);
  await prisma.customer.update({
    where: { id: customerId },
    data: { passwordHash: hash },
  });
}

/** Генерирует читаемый пароль без похожих символов (0/o, 1/l). */
export function generatePassword(length = 10): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}
