import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientSessionCustomerId } from "@/lib/client-session";
import { BUYOUT_FILE_MAX, BUYOUT_FILE_TYPES, buyoutFileUrl, buyoutFilesDir, newBuyoutFileName } from "@/lib/buyout-files";

// Загрузка вложения выкупа или пополнения (скриншот, QR-код, фото). Клиент — в свою папку,
// сотрудник — за клиента, которого передал в customerId (карточка выкупа, просмотр кабинета).
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

  const ext = BUYOUT_FILE_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Можно картинку: JPEG, PNG, WebP или GIF" }, { status: 400 });
  if (file.size > BUYOUT_FILE_MAX) return NextResponse.json({ error: "Файл больше 5 МБ" }, { status: 400 });

  const name = newBuyoutFileName(customerId, ext);
  const dir = buyoutFilesDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: buyoutFileUrl(name), name: file.name.slice(0, 120) || name });
}
