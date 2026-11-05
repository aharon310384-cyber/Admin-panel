import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Номера документов: префикс + порядковый номер строки, например PS-000001.
 * Префикс — латиница по первым буквам русского названия (читается сканерами и складом в Китае).
 * Задача на формирование посылки нумеруется иначе — как в Excel (SM3956US), см. lib/parcel-number.ts.
 */
export const DOCUMENT_PREFIXES = {
  order: "ZK", // Заказ
  sorting: "SR", // Сортировка
  receiving: "PR", // Приём заказа
  placement: "RS", // Раскладка
  assembly: "SB", // Сборка
  packing: "UP", // Упаковка
  weighing: "VZ", // Взвешивание
  parcel: "PS", // Посылка
  box: "KR", // Комплектация коробов
  manifest: "RO", // Реестр отправки
  awb: "AW", // Документы AWB
  agentInvoice: "SA", // Счёт на оплату услуг (от агента)
  agentPayout: "VA", // Заявка на выплату агенту
  topUpRequest: "PB", // Заявка на пополнение баланса клиента
  payment: "PD", // Приход ДС
  paymentAllocation: "RP", // Распределение оплат по посылкам
  clientLedger: "DK", // Изменение долга клиента
  purchase: "VK", // Покупка — префикс по умолчанию; свой задаётся в настройках покупки (PurchaseSettings.numberPrefix)
} as const;

export type DocumentType = keyof typeof DOCUMENT_PREFIXES;

type Db = PrismaClient | Prisma.TransactionClient;

const NUMBER_DIGITS = 6;

export function formatDocumentNumber(type: DocumentType, value: number, prefix: string = DOCUMENT_PREFIXES[type]) {
  return `${prefix}-${String(value).padStart(NUMBER_DIGITS, "0")}`;
}

/** Префикс из настроек: 1–5 латинских букв и не занятый другим видом документа. Иначе — null (берётся стандартный). */
export function customPrefix(type: DocumentType, value: string | null | undefined): string | null {
  const prefix = value?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{1,5}$/.test(prefix)) return null;
  const taken = Object.entries(DOCUMENT_PREFIXES).some(([other, p]) => other !== type && p === prefix);
  return taken ? null : prefix;
}

/** Номер документа выдан этой системой (а не перенесён из Excel). */
export function isDocumentNumber(type: DocumentType, value: string | null | undefined) {
  return new RegExp(`^${DOCUMENT_PREFIXES[type]}-\\d+$`).test(value?.trim() ?? "");
}

/**
 * Следующий номер документа. Счётчик увеличивается одним запросом (upsert),
 * поэтому два документа одного вида не получат одинаковый номер.
 * Вызывать в той же транзакции, где создаётся документ.
 */
export async function nextDocumentNumber(db: Db, type: DocumentType, options: { prefix?: string | null } = {}) {
  const prefix = customPrefix(type, options.prefix) ?? DOCUMENT_PREFIXES[type];
  const counter = await db.documentCounter.upsert({
    where: { prefix },
    create: { prefix, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return formatDocumentNumber(type, counter.lastValue, prefix);
}
