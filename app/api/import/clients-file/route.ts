import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readClientsFile } from "@/lib/clients-file";

// Список клиентов файлом .xlsx → строки с колонками по заголовкам. В базу ничего не пишет:
// план и применение — actions/clients-import.ts.

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Файл больше 10 МБ" }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: "Нужен файл .xlsx (в WPS: Файл → Сохранить как → Excel .xlsx)" }, { status: 400 });

  try {
    const result = await readClientsFile(await file.arrayBuffer());
    return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать файл — сохраните его как .xlsx и попробуйте снова" }, { status: 400 });
  }
}
