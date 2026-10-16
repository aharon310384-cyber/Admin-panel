import type { Prisma } from "@prisma/client";

/**
 * Префиксы номеров документов: латиница по первым буквам русского названия.
 * Номер = префикс + порядковый номер строки, например PS-000001.
 * Задача на формирование посылки нумеруется иначе — см. ниже.
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
} as const;

export type DocumentType = keyof typeof DOCUMENT_PREFIXES;

const NUMBER_DIGITS = 6;

export function formatDocumentNumber(type: DocumentType, value: number) {
  return `${DOCUMENT_PREFIXES[type]}-${String(value).padStart(NUMBER_DIGITS, "0")}`;
}

async function nextCounterValue(tx: Prisma.TransactionClient, key: string) {
  const counter = await tx.documentCounter.upsert({
    where: { prefix: key },
    create: { prefix: key, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return counter.lastValue;
}

/**
 * Выдаёт следующий номер документа. Счётчик увеличивается одним запросом
 * (upsert), поэтому два документа одного типа не получат одинаковый номер.
 * Вызывать внутри той же транзакции, где создаётся документ.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  type: DocumentType
) {
  const prefix = DOCUMENT_PREFIXES[type];
  return formatDocumentNumber(type, await nextCounterValue(tx, prefix));
}

// ─── Задача на формирование посылки ─────────────────────────────────────────
// Формат из Excel: код клиента + порядковый номер + страна доставки, AT1536DE.
// Порядковый номер общий для всех клиентов и продолжает нумерацию Excel.

export const PARCEL_TASK_COUNTER = "PARCEL_TASK";

const TASK_SEQUENCE_DIGITS = 4;

export function formatParcelTaskNumber(
  customerCode: string,
  sequence: number,
  country: string
) {
  return `${customerCode.trim().toUpperCase()}${String(sequence).padStart(TASK_SEQUENCE_DIGITS, "0")}${country.trim().toUpperCase()}`;
}

export async function nextParcelTaskNumber(
  tx: Prisma.TransactionClient,
  customerCode: string,
  country: string
) {
  const sequence = await nextCounterValue(tx, PARCEL_TASK_COUNTER);
  return formatParcelTaskNumber(customerCode, sequence, country);
}

/** Не даёт счётчику задач отстать от номеров, уже взятых из Excel. */
export async function raiseParcelTaskCounter(
  tx: Prisma.TransactionClient,
  sequence: number
) {
  const current = await tx.documentCounter.findUnique({
    where: { prefix: PARCEL_TASK_COUNTER },
  });
  if (current && current.lastValue >= sequence) return;

  await tx.documentCounter.upsert({
    where: { prefix: PARCEL_TASK_COUNTER },
    create: { prefix: PARCEL_TASK_COUNTER, lastValue: sequence },
    update: { lastValue: sequence },
  });
}

export type LegacyParcelTaskNumber = {
  number: string;
  customerCode: string;
  sequence: number;
  country: string;
  /** Приписка после номера, например «01 DHL» или «Sea». */
  tail: string | null;
};

const LEGACY_TASK_NUMBER = /^([A-Za-z]+)(\d+)([A-Za-z]{2})(?![A-Za-z])(.*)$/;

/** Разбирает номер из Excel вида «AT1536DE 01 DHL». */
export function parseLegacyParcelTaskNumber(
  raw: string
): LegacyParcelTaskNumber | null {
  const match = raw.trim().match(LEGACY_TASK_NUMBER);
  if (!match) return null;

  const [, code, digits, country, rest] = match;
  const customerCode = code.toUpperCase();
  const countryCode = country.toUpperCase();
  const tail = rest.replace(/^[\s\-_/]+/, "").trim();

  return {
    number: `${customerCode}${digits}${countryCode}`,
    customerCode,
    sequence: Number(digits),
    country: countryCode,
    tail: tail || null,
  };
}
