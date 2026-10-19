import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { brandInitials } from "@/lib/brand";

// Значок вкладки браузера в админке — чтобы её не путать с кабинетом клиента.
// Знак компании-склада, если загружен («Администрирование → Компании»), иначе её буквы на цветном квадрате.

export const dynamic = "force-dynamic";

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET() {
  const company = await prisma.company.findFirst({
    where: { adminBrand: true },
    select: { name: true, icon: true, iconType: true },
    orderBy: { createdAt: "asc" },
  });
  const headers = { "Cache-Control": "public, max-age=86400" };
  if (company?.icon && company.iconType) {
    return new NextResponse(Buffer.from(company.icon), { headers: { ...headers, "Content-Type": company.iconType } });
  }
  const letters = escapeXml(brandInitials(company?.name ?? "Админ-панель"));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9772f"/><stop offset="0.48" stop-color="#bb5a2c"/><stop offset="1" stop-color="#9c4424"/></linearGradient></defs>
<rect width="64" height="64" rx="14" fill="url(#g)"/>
<text x="32" y="43" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#fff">${letters}</text>
</svg>`;
  return new NextResponse(svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
