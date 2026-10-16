import type { Prisma } from "@prisma/client";

/**
 * Префиксы номеров документов: латиница по первым буквам русского названия.
 * Номер = префикс + порядковый номер, например ZK-000001.
 * Посылки сохраняют свой формат (AT1536DE из Excel), поэтому их здесь нет.
 */
export const DOCUMENT_PREFIXES = {
  order: "ZK", // Заказ
  sorting: "SR", // Сортировка
  receiving: "PR", // Приём заказа
  placement: "RS", // Раскладка
  parcelTask: "ZF", // Задача на формирование посылки
  assembly: "SB", // Сборка
  packing: "UP", // Упаковка
  weighing: "VZ", // Взвешивание
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
  const counter = await tx.documentCounter.upsert({
    where: { prefix },
    create: { prefix, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  return formatDocumentNumber(type, counter.lastValue);
}
