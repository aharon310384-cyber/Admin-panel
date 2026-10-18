import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { COMPANY_IMAGES, type CompanyImage } from "@/lib/brand";

// Логотип и знак компании: хранятся в базе, а не в файлах, — переживают любой деплой.
// GET — открыт всем (страница входа и кабинет показывают их до входа), POST и DELETE — только администратор.

const MAX_SIZE = 2 * 1024 * 1024; // 2 МБ

type Params = { params: Promise<{ id: string; image: string }> };

function imageKind(value: string): CompanyImage | null {
  return COMPANY_IMAGES.includes(value as CompanyImage) ? (value as CompanyImage) : null;
}

// Тип по первым байтам файла, а не по тому, что прислал браузер. SVG не принимается: в нём может быть скрипт.
function detectType(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

// Логотип виден на всех страницах (шапка, вход, кабинет) — обновляем все.
function revalidateBrand() {
  revalidatePath("/", "layout");
}

export async function GET(_request: Request, { params }: Params) {
  const { id, image } = await params;
  const kind = imageKind(image);
  if (!kind) return new NextResponse(null, { status: 404 });

  const company = await prisma.company.findUnique({
    where: { id },
    select: { logo: true, logoType: true, icon: true, iconType: true },
  });
  const bytes = kind === "logo" ? company?.logo : company?.icon;
  const type = kind === "logo" ? company?.logoType : company?.iconType;
  if (!bytes || !type) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      // Адрес картинки меняется после каждого сохранения компании (?v=…), поэтому можно хранить долго.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  const { id, image } = await params;
  const kind = imageKind(image);
  if (!kind) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Файл больше 2 МБ — уменьшите картинку" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectType(bytes);
  if (!type) return NextResponse.json({ error: "Подходят картинки PNG, JPEG и WebP" }, { status: 400 });

  const data = kind === "logo" ? { logo: bytes, logoType: type } : { icon: bytes, iconType: type };
  const updated = await prisma.company.updateMany({ where: { id }, data: { ...data, updatedBy: session.user.id } });
  if (!updated.count) return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });

  revalidateBrand();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  const { id, image } = await params;
  const kind = imageKind(image);
  if (!kind) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const data = kind === "logo" ? { logo: null, logoType: null } : { icon: null, iconType: null };
  await prisma.company.updateMany({ where: { id }, data: { ...data, updatedBy: session.user.id } });

  revalidateBrand();
  return NextResponse.json({ ok: true });
}
