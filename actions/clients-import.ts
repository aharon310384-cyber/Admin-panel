"use server";

// Список клиентов из Excel (владелец 2026-10-27: «обнови список клиентов», «лишнее убирай»): сначала план — кто новый,
// у кого что изменится, кого нет в файле; потом «Применить». Пустая ячейка и «x» ничего не стирают.
// Страна — только из справочника, по-английски; город — по-английски (lib/geo-names.ts).
// Убранный клиент помечается удалённым: его посылки, заказы и получатели остаются, в списке его не видно.

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-helpers";
import { latinCode } from "@/lib/excel-check";
import { englishCity, matchCountry } from "@/lib/geo-names";
import type { ClientFileRow, ClientImportChange, ClientImportField, ClientImportRow, ClientsImportPlan } from "@/lib/clients-import";

const MAX_ROWS = 5000;
const EMPTY = new Set(["x", "х", "-", "—", "–", "нет", "none", "n/a"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value: string | undefined) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text && !EMPTY.has(text.toLowerCase()) ? text : null;
};

type Existing = Prisma.CustomerGetPayload<{
  select: {
    id: true; code: true; name: true; lastName: true; firstName: true; middleName: true; phone: true;
    telegramUsername: true; email: true; country: true; city: true; deletedAt: true;
  };
}>;
type Write = { row: ClientImportRow; id: string | null; data: Partial<Record<ClientImportField, string>> };

async function buildPlan(input: ClientFileRow[]): Promise<{ plan: ClientsImportPlan; writes: Write[] }> {
  const rows = input.slice(0, MAX_ROWS);
  const [clients, countries] = await Promise.all([
    prisma.customer.findMany({
      select: {
        id: true, code: true, name: true, lastName: true, firstName: true, middleName: true, phone: true,
        telegramUsername: true, email: true, country: true, city: true, deletedAt: true,
        _count: { select: { recipients: { where: { deletedAt: null } }, orders: { where: { deletedAt: null } }, parcels: { where: { deletedAt: null } } } },
      },
    }),
    prisma.country.findMany({ select: { code: true, nameRu: true, nameEn: true, aliases: true } }),
  ]);
  const byCode = new Map<string, Existing>();
  for (const c of clients) {
    const code = latinCode(c.code);
    // активный клиент важнее убранного с тем же кодом
    if (code && (!byCode.has(code) || !c.deletedAt)) byCode.set(code, c);
  }
  const emailOwner = new Map(clients.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]));

  const seenCodes = new Map<string, number>();
  const seenEmails = new Set<string>();
  const planRows: ClientImportRow[] = [];
  const writes: Write[] = [];

  for (const { excelRow, values } of rows) {
    const code = latinCode(clean(values.code));
    const notes: string[] = [];
    const fail = (message: string) => planRows.push({ excelRow, code: code || values.code || "", name: "", action: "error", changes: [], notes: [message] });
    if (!/^[A-Z]{2,4}$/.test(code)) {
      fail(`Код «${values.code ?? ""}» — нужны 2–4 латинские буквы`);
      continue;
    }
    if (seenCodes.has(code)) {
      fail(`Код ${code} повторяется в файле (строка ${seenCodes.get(code)}) — строка пропущена`);
      continue;
    }
    seenCodes.set(code, excelRow);
    const existing = byCode.get(code) ?? null;

    const data: Partial<Record<ClientImportField, string>> = {};
    const lastName = clean(values.lastName);
    const firstName = clean(values.firstName);
    const middleName = clean(values.middleName);
    if (lastName) data.lastName = lastName;
    if (firstName) data.firstName = firstName;
    if (middleName) data.middleName = middleName;
    // Имя в списке — из ФИО файла; если в файле ФИО нет — остаётся прежним (у нового клиента — код)
    const fio = [lastName ?? existing?.lastName, firstName ?? existing?.firstName, middleName ?? existing?.middleName].filter(Boolean).join(" ");
    if (lastName || firstName || middleName) data.name = fio;

    const phone = clean(values.phone);
    if (phone) data.phone = phone;
    const telegram = clean(values.telegram)?.replace(/^@+/, "");
    if (telegram) data.telegramUsername = telegram;

    const email = clean(values.email)?.toLowerCase();
    if (email) {
      const owner = emailOwner.get(email);
      if (!EMAIL_RE.test(email)) notes.push(`Email «${email}» с ошибкой — не меняется`);
      else if (seenEmails.has(email)) notes.push(`Email ${email} уже есть выше в файле — не меняется`);
      else if (owner && owner.id !== existing?.id) notes.push(`Email ${email} уже у клиента ${owner.code ?? owner.name}${owner.deletedAt ? " (убран)" : ""} — не меняется`);
      else data.email = email;
      seenEmails.add(email);
    }

    const countryText = clean(values.country);
    const country = matchCountry(countryText ?? existing?.country, countries);
    if (countryText) {
      if (!country) notes.push(`Страны «${countryText}» нет в справочнике — не меняется`);
      else {
        data.country = country.nameEn;
        if (country.nameEn.toLowerCase() !== countryText.toLowerCase()) notes.push(`Страна «${countryText}» → ${country.nameEn}`);
      }
    }
    const cityText = clean(values.city);
    if (cityText) {
      const city = await englishCity(cityText, country?.code);
      data.city = city.name;
      if (city.source === "map") notes.push(`Город «${cityText}» → ${city.name}`);
      if (city.source === "letters") notes.push(`Город «${cityText}» → ${city.name} (по буквам, на карте не нашёлся — проверьте)`);
      if (city.source === "offline") notes.push(`Город «${cityText}» → ${city.name} (по буквам: карта не ответила — проверьте)`);
    }

    const changes: ClientImportChange[] = [];
    for (const [field, to] of Object.entries(data) as [ClientImportField, string][]) {
      const from = existing ? (existing[field] ?? null) : null;
      if (from !== to) changes.push({ field, from, to });
    }
    const action = !existing ? "new" : existing.deletedAt ? "restore" : changes.length ? "update" : "same";
    const row: ClientImportRow = { excelRow, code, name: data.name ?? existing?.name ?? code, action, changes, notes };
    planRows.push(row);
    if (action !== "same") writes.push({ row, id: existing?.id ?? null, data: Object.fromEntries(changes.map((c) => [c.field, c.to])) });
  }

  const inFile = new Set(seenCodes.keys());
  const notInFile = clients
    .filter((c) => !c.deletedAt && !inFile.has(latinCode(c.code)))
    .map((c) => ({ id: c.id, code: c.code, name: c.name, recipients: c._count.recipients, orders: c._count.orders, parcels: c._count.parcels }))
    .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
  return { plan: { rows: planRows, notInFile }, writes };
}

/** План загрузки: в базу ничего не пишет. */
export async function previewClientsFile(rows: ClientFileRow[]): Promise<ClientsImportPlan> {
  await requireAdmin();
  return (await buildPlan(rows)).plan;
}

export type ClientsImportResult = { ok: true; created: number; updated: number; restored: number; removed: number } | { ok: false; error: string };

/** Применить: план считается заново по тем же строкам; убираются только отмеченные клиенты, которых нет в файле. */
export async function applyClientsFile(rows: ClientFileRow[], removeIds: string[]): Promise<ClientsImportResult> {
  await requireAdmin();
  const { plan, writes } = await buildPlan(rows);
  const removable = new Set(plan.notInFile.map((c) => c.id));
  const remove = [...new Set(removeIds)].filter((id) => removable.has(id));
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      if (remove.length) await tx.customer.updateMany({ where: { id: { in: remove }, deletedAt: null }, data: { deletedAt: now } });
      for (const { row, id, data } of writes) {
        if (id) await tx.customer.update({ where: { id }, data: { ...data, ...(row.action === "restore" ? { deletedAt: null } : {}) } });
        else await tx.customer.create({ data: { ...data, code: row.code, name: data.name ?? row.code } });
      }
    }, { timeout: 120_000 });
  } catch (error) {
    console.error("[clients-import]", error);
    return { ok: false, error: "Не удалось сохранить — ничего не изменено. Проверьте файл (повторы кодов и email) и попробуйте снова." };
  }
  revalidatePath("/clients");
  const count = (action: ClientImportRow["action"]) => writes.filter((w) => w.row.action === action).length;
  return { ok: true, created: count("new"), updated: count("update"), restored: count("restore"), removed: remove.length };
}
