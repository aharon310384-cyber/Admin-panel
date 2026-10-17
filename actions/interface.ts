"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-helpers";
import {
  COLUMN_KEY_MAX,
  COLUMN_MAX,
  COLUMN_MIN,
  FORM_KEY_RE,
  FORM_PARTS,
  MAX_COLUMNS,
  normalizeForms,
  type ColumnWidths,
  type FormPart,
} from "@/lib/form";
import {
  FAVORITES_LIMIT,
  HISTORY_LIMIT,
  MAX_GROUPS,
  MAX_GROUP_SIZE,
  PANEL_CODES,
  normalizeFavorites,
  normalizeHistory,
  normalizePanels,
  type PageRef,
  type PanelLayout,
} from "@/lib/interface";

const panelGroups = z.array(z.array(z.enum(PANEL_CODES)).min(1).max(MAX_GROUP_SIZE)).max(MAX_GROUPS);
const panelsSchema = z.object({ top: panelGroups, left: panelGroups, right: panelGroups, bottom: panelGroups });
const formSchema = z.object({
  formKey: z.string().regex(FORM_KEY_RE),
  hidden: z.array(z.enum(FORM_PARTS)).max(FORM_PARTS.length).optional(),
  widths: z
    .record(z.string().max(COLUMN_KEY_MAX), z.number().int().min(COLUMN_MIN).max(COLUMN_MAX))
    .refine((value) => Object.keys(value).length <= MAX_COLUMNS)
    .nullable()
    .optional(),
});

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

// «Закрепить сверху» в списке избранного — или снять закрепление. Возвращает новый список.
export async function pinFavorite(path: string, pinned: boolean) {
  const session = await requireAuth();
  const current = normalizeFavorites((await settingsOf(session.user.id))?.favorites);
  if (!current.some((item) => item.path === path)) return { favorites: current };
  const favorites = current.map((item) =>
    item.path !== path ? item : pinned ? { ...item, pinned: true } : { path: item.path, href: item.href, title: item.title }
  );
  await prisma.userInterfaceSettings.update({ where: { userId: session.user.id }, data: { favorites } });
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

// Настройка окна: hidden — скрытые части («Изменить форму…», пустой список — все видны),
// widths — ширины столбцов (null — стандартные). Что не передано, не меняется. Возвращает настройку всех окон.
export type FormSettingsPatch = { hidden?: FormPart[]; widths?: ColumnWidths | null };

export async function saveFormSettings(formKey: string, patch: FormSettingsPatch) {
  const session = await requireAuth();
  const parsed = formSchema.safeParse({ formKey, ...patch });
  if (!parsed.success) return { error: "Неверная настройка формы" };
  const { hidden, widths } = parsed.data;
  const current = normalizeForms((await settingsOf(session.user.id))?.forms);
  const entry = current[parsed.data.formKey] ?? { hidden: [] };
  const forms = normalizeForms({
    ...current,
    [parsed.data.formKey]: {
      hidden: hidden ?? entry.hidden,
      widths: widths === undefined ? entry.widths : widths ?? undefined,
    },
  });
  const value = Object.keys(forms).length ? forms : Prisma.DbNull;
  await prisma.userInterfaceSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, forms: value },
    update: { forms: value },
  });
  return { forms };
}
