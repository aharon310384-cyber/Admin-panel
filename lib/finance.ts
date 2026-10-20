import "server-only";

import type { ParcelStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type FinanceSettingsView = {
  id: string;
  exchangeRateCnyPerUsd: number | null; // null — курс не задан
  exchangeRateCnyPerEur: number | null;
  euDutyEnabled: boolean;
  euDutyPassToClient: boolean;
  updatedAt: Date;
};

// Курс берётся только из «Финансы → Курс»: запасного числа в коде нет. Не задан — расчёт останавливается с этим сообщением.
export const RATE_USD_MISSING = "Не задан курс ¥ за $ — задайте его в «Финансы → Курс».";
export const RATE_EUR_MISSING = "Не задан курс ¥ за € для пошлины ЕС — задайте его в «Финансы → Курс».";

const rateOf = (value: Prisma.Decimal | null) => (value != null && Number(value) > 0 ? Number(value) : null);

export async function getFinanceSettings(): Promise<FinanceSettingsView> {
  let settings = await prisma.financeSettings.findFirst();
  if (!settings) {
    settings = await prisma.financeSettings.create({ data: {} });
  }
  return {
    id: settings.id,
    exchangeRateCnyPerUsd: rateOf(settings.exchangeRateCnyPerUsd),
    exchangeRateCnyPerEur: rateOf(settings.exchangeRateCnyPerEur),
    euDutyEnabled: settings.euDutyEnabled,
    euDutyPassToClient: settings.euDutyPassToClient,
    updatedAt: settings.updatedAt,
  };
}

export type RatesStats = {
  parcelsTotal: number;
  parcelsOnCurrentRate: number;
  totalUsdAll: number;
  totalCnyAll: number;
};

export async function getRatesStats(currentRate: number | null): Promise<RatesStats> {
  const epsilon = 0.0001;
  const [parcelsTotal, parcelsOnCurrentRate, sums] = await Promise.all([
    prisma.parcel.count({ where: { deletedAt: null } }),
    currentRate == null
      ? 0
      : prisma.parcel.count({
          where: {
            deletedAt: null,
            exchangeRateCnyPerUsd: {
              gte: currentRate - epsilon,
              lte: currentRate + epsilon,
            },
          },
        }),
    prisma.parcel.aggregate({
      where: { deletedAt: null },
      _sum: { totalUsd: true, totalCny: true },
    }),
  ]);

  return {
    parcelsTotal,
    parcelsOnCurrentRate,
    totalUsdAll: Number(sums._sum.totalUsd ?? 0),
    totalCnyAll: Number(sums._sum.totalCny ?? 0),
  };
}

export type PaymentRow = {
  id: string;
  number: string;
  taskNumber: string | null;
  customerName: string;
  customerCode: string | null;
  createdAt: Date;
  totalUsd: number;
  exchangeRateCnyPerUsd: number;
  totalCny: number;
  isPaid: boolean;
  status: ParcelStatus;
};

export const PAYMENTS_SORT_FIELDS = [
  "createdAt",
  "number",
  "customerCode",
  "status",
  "totalUsd",
  "exchangeRate",
  "totalCny",
  "isPaid",
] as const;
export type PaymentsSortField = (typeof PAYMENTS_SORT_FIELDS)[number];
export type PaymentsSortDirection = "asc" | "desc";

function paymentsOrderBy(
  field: PaymentsSortField,
  dir: PaymentsSortDirection
): Prisma.ParcelOrderByWithRelationInput {
  switch (field) {
    case "customerCode":
      return { customer: { code: dir } };
    case "number":
      return { number: dir };
    case "status":
      return { status: dir };
    case "totalUsd":
      return { totalUsd: dir };
    case "exchangeRate":
      return { exchangeRateCnyPerUsd: dir };
    case "totalCny":
      return { totalCny: dir };
    case "isPaid":
      return { isPaid: dir };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

export type PaymentsRegistry = {
  rows: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    countPaid: number;
    countUnpaid: number;
    sumPaidCny: number;
    sumUnpaidCny: number;
    sumPaidUsd: number;
    sumUnpaidUsd: number;
  };
};

export type PaymentsFilter = "all" | "paid" | "unpaid";

export async function getPaymentsRegistry({
  page = 1,
  pageSize = 20,
  filter = "all",
  sortField = "createdAt",
  sortDir = "desc",
}: {
  page?: number;
  pageSize?: number;
  filter?: PaymentsFilter;
  sortField?: PaymentsSortField;
  sortDir?: PaymentsSortDirection;
} = {}): Promise<PaymentsRegistry> {
  const where: Prisma.ParcelWhereInput = {
    deletedAt: null,
    ...(filter === "paid" ? { isPaid: true } : {}),
    ...(filter === "unpaid" ? { isPaid: false } : {}),
  };

  const [rows, total, paidAgg, unpaidAgg] = await Promise.all([
    prisma.parcel.findMany({
      where,
      include: { customer: true, parcelTask: { select: { number: true } } },
      orderBy: paymentsOrderBy(sortField, sortDir),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.parcel.count({ where }),
    prisma.parcel.aggregate({
      where: { deletedAt: null, isPaid: true },
      _sum: { totalCny: true, totalUsd: true },
      _count: true,
    }),
    prisma.parcel.aggregate({
      where: { deletedAt: null, isPaid: false },
      _sum: { totalCny: true, totalUsd: true },
      _count: true,
    }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      number: row.number,
      taskNumber: row.parcelTask?.number ?? null,
      customerName: row.customer.name,
      customerCode: row.customer.code,
      createdAt: row.createdAt,
      totalUsd: Number(row.totalUsd ?? 0),
      exchangeRateCnyPerUsd: Number(row.exchangeRateCnyPerUsd ?? 0),
      totalCny: Number(row.totalCny ?? 0),
      isPaid: row.isPaid,
      status: row.status,
    })),
    total,
    page,
    pageSize,
    summary: {
      countPaid: paidAgg._count,
      countUnpaid: unpaidAgg._count,
      sumPaidCny: Number(paidAgg._sum.totalCny ?? 0),
      sumUnpaidCny: Number(unpaidAgg._sum.totalCny ?? 0),
      sumPaidUsd: Number(paidAgg._sum.totalUsd ?? 0),
      sumUnpaidUsd: Number(unpaidAgg._sum.totalUsd ?? 0),
    },
  };
}
