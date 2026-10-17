"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-helpers";
import {
  FAVORITES_LIMIT,
  HISTORY_LIMIT,
  PANEL_CODES,
  normalizeFavorites,
  normalizeHistory,
  normalizePanels,
  type PageRef,
  type PanelLayout,
} from "@/lib/interface";

const panelList = z.array(z.enum(PANEL_CODES)).max(PANEL_CODES.length);
const panelsSchema = z.object({ top: panelList, left: panelList, right: panelList, bottom: panelList });

// Адрес страницы админки: только свой сайт, без «//» и схем.
const pageSchema = z.object({
  path: z.string().max(300).regex(/^\/(?!\/)[^\s]*$/),
  href: z.string().max(500).regex(/^\/(?!\/)[^\s]*$/),
  title: z.string().trim().min(1).max(120),
});

async function settingsOf(userId: string) {
  return prisma.userInterfaceSettings.findUnique({ where: { userId } });
}

// «Настройка панелей»: сохранить расположение. null — стандартные (пусто в базе: подхватят и будущие стандартные).
export async function savePanels(layout: PanelLayout | null) {
  const session = await requireAuth();
  let panels: PanelLayout | typeof Prisma.DbNull = Prisma.DbNull;
  if (layout) {
    const parsed = panelsSchema.safeParse(layout);
    if (!parsed.success) return { error: "Неверная настройка панелей" };
    panels = normalizePanels(parsed.data);
  }
  await prisma.userInterfaceSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, panels },
    update: { panels },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Звёздочка: добавить страницу в избранное или убрать оттуда. Возвращает новый список.
export async function toggleFavorite(page: PageRef) {
  const session = await requireAuth();
  const parsed = pageSchema.safeParse(page);
  if (!parsed.success) return { error: "Неверная страница" };
  const current = normalizeFavorites((await settingsOf(session.user.id))?.favorites);
  const exists = current.some((item) => item.path === parsed.data.path);
  const favorites = exists
    ? current.filter((item) => item.path !== parsed.data.path)
    : [...current, parsed.data].slice(-FAVORITES_LIMIT);
  await prisma.userInterfaceSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, favorites },
    update: { favorites },
  });
  return { favorites };
}

// История: страница, которую сотрудник только что открыл (новые первыми, без повторов).
export async function recordVisit(page: PageRef) {
  const session = await requireAuth();
  const parsed = pageSchema.safeParse(page);
  if (!parsed.success) return;
  const current = normalizeHistory((await settingsOf(session.user.id))?.history);
  const history = [
    { ...parsed.data, at: new Date().toISOString() },
    ...current.filter((item) => item.path !== parsed.data.path),
  ].slice(0, HISTORY_LIMIT);
  await prisma.userInterfaceSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, history },
    update: { history },
  });
}
