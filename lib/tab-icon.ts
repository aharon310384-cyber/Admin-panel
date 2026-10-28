import "server-only";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { brandColor, brandInitials } from "@/lib/brand";

// Значок вкладки браузера: знак компании, если загружен («Администрирование → Компании»),
// иначе её буквы на квадрате основного цвета компании (не задан — стандартного цвета).

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Смесь цвета #RRGGBB с белым или чёрным: share — доля исходного цвета. */
function mix(hex: string, other: 0 | 255, share: number): string {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return `#${channels.map((value) => Math.round(value * share + other * (1 - share)).toString(16).padStart(2, "0")).join("")}`;
}

type Gradient = [light: string, base: string, dark: string];

export async function tabIconResponse(where: { adminBrand: true } | { cabinetBrand: true }, fallback: { name: string; gradient: Gradient }) {
  const company = await prisma.company.findFirst({
    where,
    select: { name: true, icon: true, iconType: true, primaryColor: true },
    orderBy: { createdAt: "asc" },
  });
  const headers = { "Cache-Control": "public, max-age=86400" };
  if (company?.icon && company.iconType) {
    return new NextResponse(Buffer.from(company.icon), { headers: { ...headers, "Content-Type": company.iconType } });
  }
  const color = brandColor(company?.primaryColor);
  const [light, base, dark]: Gradient = color ? [mix(color, 255, 0.82), color, mix(color, 0, 0.82)] : fallback.gradient;
  const letters = escapeXml(brandInitials(company?.name ?? fallback.name));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.48" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
<rect width="64" height="64" rx="14" fill="url(#g)"/>
<text x="32" y="43" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#fff">${letters}</text>
</svg>`;
  return new NextResponse(svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
