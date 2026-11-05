import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientSessionCustomerId } from "@/lib/client-session";
import { PURCHASE_FILE_MAX, PURCHASE_FILE_TYPES, purchaseFileUrl, purchaseFilesDir, newPurchaseFileName } from "@/lib/purchase-files";

// Загрузка вложения покупки или пополнения (скриншот, QR-код, фото). Клиент — в свою папку,
// сотрудник — за клиента, которого передал в customerId (карточка покупки, просмотр кабинета).
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });

  let customerId = await getClientSessionCustomerId();
  if (!customerId) {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    const requested = String(form.get("customerId") ?? "");
    const customer = requested ? await prisma.customer.findFirst({ where: { id: requested, deletedAt: null }, select: { id: true } }) : null;
    if (!customer) return NextResponse.json({ error: "Не выбран клиент" }, { status: 400 });
    customerId = customer.id;
  }

  const ext = PURCHASE_FILE_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Можно картинку: JPEG, PNG, WebP или GIF" }, { status: 400 });
  if (file.size > PURCHASE_FILE_MAX) return NextResponse.json({ error: "Файл больше 5 МБ" }, { status: 400 });

  const name = newPurchaseFileName(customerId, ext);
  const dir = purchaseFilesDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: purchaseFileUrl(name), name: file.name.slice(0, 120) || name });
}
