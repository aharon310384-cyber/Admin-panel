import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cleanColumns } from "@/lib/excel-columns";
import { readExcelFile } from "@/lib/excel-file";

// Загрузка из Excel файлом: файл .xlsx → листы и строки задач с отметкой «уже в базе» / «нет клиента».
// В базу ничего не пишет: строки загружаются потом по одной (actions/excel-row.ts → importExcelRow).

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SIZE = 40 * 1024 * 1024; // 40 MB

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

  const settings = await prisma.excelImportSettings.findFirst({ select: { columns: true } });
  const columns = cleanColumns(settings?.columns);
  if (!columns.taskNumber || !columns.info) return NextResponse.json({ error: "Сначала укажите колонки листа" }, { status: 400 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Файл больше 40 МБ" }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: "Нужен файл .xlsx (в WPS: Файл → Сохранить как → Excel .xlsx)" }, { status: 400 });

  let sheets;
  try {
    sheets = await readExcelFile(await file.arrayBuffer(), columns);
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать файл — сохраните его как .xlsx и попробуйте снова" }, { status: 400 });
  }

  const numbers = [...new Set(sheets.flatMap((s) => s.rows.map((r) => r.taskNumber)))];
  const codes = [...new Set(numbers.map((n) => n.match(/^[A-Z]{2,4}(?=\d)/)?.[0]).filter((c): c is string => Boolean(c)))];
  const [tasks, customers] = await Promise.all([
    prisma.parcelTask.findMany({ where: { number: { in: numbers } }, select: { number: true } }),
    prisma.customer.findMany({ where: { code: { in: codes }, deletedAt: null }, select: { code: true } }),
  ]);
  const inBase = new Set(tasks.map((t) => t.number));
  const known = new Set(customers.map((c) => c.code));

  return NextResponse.json({
    sheets: sheets.map((s) => ({
      name: s.name,
      rows: s.rows.map((r) => ({
        ...r,
        inBase: inBase.has(r.taskNumber),
        clientExists: known.has(r.taskNumber.match(/^[A-Z]{2,4}(?=\d)/)?.[0] ?? ""),
      })),
    })),
  });
}
