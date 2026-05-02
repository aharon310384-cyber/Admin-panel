import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function resolveUploadPath(filename: string) {
  const configuredDir = process.env.UPLOAD_DIR ?? "public/uploads";
  const uploadDir = path.isAbsolute(configuredDir)
    ? configuredDir
    : path.join(process.cwd(), configuredDir);
  const publicDir = path.join(process.cwd(), "public");
  const filePath = path.join(uploadDir, filename);
  const publicRelativePath = path.relative(publicDir, filePath).replace(/\\/g, "/");

  if (publicRelativePath.startsWith("..") || path.isAbsolute(publicRelativePath)) {
    throw new Error("UPLOAD_DIR должен находиться внутри public");
  }

  return {
    uploadDir,
    filePath,
    publicUrl: `/${publicRelativePath}`,
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Допустимые форматы: JPEG, PNG, WebP, GIF" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Размер файла не должен превышать 5 МБ" },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { uploadDir, filePath, publicUrl } = resolveUploadPath(filename);

  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return NextResponse.json({ url: publicUrl });
}
