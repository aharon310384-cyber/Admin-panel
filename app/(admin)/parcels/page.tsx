import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { deliveryTypeLabel } from "@/lib/statuses";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";
import { trackingStatusLabel } from "@/lib/tracking-labels";
import { clientFields, readListSearch, searchConditions, searchParamsOf, type ServerSearchField } from "@/lib/list-search";
import Form from "@/components/form/form";
import ParcelsTable, { type ParcelRow } from "@/components/parcels/parcels-table";
import StatusByTracks from "@/components/parcels/status-by-tracks";

export const metadata: Metadata = { title: "Посылки" };

const SORT_FIELDS = [
  "customerCode",
  "trackingNumber",
  "taskNumber",
  "status",
  "recipientName",
  "deliveryType",
  "ordersCount",
  "billableWeightKg",
  "totalUsd",
  "isPaid",
  "createdAt",
] as const;
type SortField = (typeof SORT_FIELDS)[number];

function parcelOrderBy(field: SortField, dir: SortDirection): Prisma.ParcelOrderByWithRelationInput {
  switch (field) {
    case "customerCode":
      return { customer: { code: dir } };
    case "recipientName":
      return { recipient: { name: dir } };
    case "ordersCount":
      return { orders: { _count: dir } };
    case "trackingNumber":
      return { trackingNumber: dir };
    case "taskNumber":
      return { parcelTask: { number: dir } };
    case "status":
      return { status: dir };
    case "deliveryType":
      return { deliveryType: dir };
    case "billableWeightKg":
      return { billableWeightKg: dir };
    case "totalUsd":
      return { totalUsd: dir };
    case "isPaid":
      return { isPaid: dir };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

// Поиск списка (строка поиска и «Расширенный поиск»): подписи — как заголовки столбцов таблицы.
const SEARCH_FIELDS: ServerSearchField<Prisma.ParcelWhereInput>[] = [
  { key: "track", label: "Трек-номер", where: (f) => ({ trackingNumber: f }) },
  { key: "task", label: "Задача", where: (f) => ({ parcelTask: { number: f } }) },
  { key: "client", label: "Клиент", where: (f) => ({ customer: { OR: [{ code: f }, { name: f }] } }) },
  { key: "recipient", label: "Получатель", where: (f) => ({ recipient: { name: f } }) },
  { key: "number", label: "Номер посылки", where: (f) => ({ number: f }) },
  { key: "incoming", label: "Входящий трек-номер", where: (f) => ({ orders: { some: { deletedAt: null, trackNumber: f } } }) },
];
const LIMIT = 200;

export default async function ParcelsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tracking?: string; q?: string; sf?: string; sv?: string; sm?: string }>;
}) {
  const params = await searchParams;
  const search = readListSearch(params);
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");
  const onlyProblems = params.tracking === "problem";
  // «Требуют внимания»: отправленные, по которым 17TRACK сообщил о проблеме
  const problemWhere: Prisma.ParcelWhereInput = { status: "SHIPPED", tracking: { problem: true } };

  const where: Prisma.ParcelWhereInput = {
    deletedAt: null,
    ...(onlyProblems ? problemWhere : {}),
    AND: searchConditions(search, SEARCH_FIELDS),
  };

  const [parcels, total, problemCount] = await Promise.all([
    prisma.parcel.findMany({
      where,
      include: {
        customer: { select: { name: true, code: true } },
        recipient: { select: { name: true } },
        parcelTask: { select: { number: true } },
        tracking: { select: { status: true, subStatus: true, problem: true, registeredAt: true, error: true, event: true, location: true, eventAt: true } },
        _count: { select: { orders: true } },
      },
      orderBy: parcelOrderBy(sortField, sortDir),
      take: LIMIT,
    }),
    prisma.parcel.count({ where }),
    prisma.parcel.count({ where: { deletedAt: null, ...problemWhere } }),
  ]);

  const filter = { tracking: onlyProblems ? "problem" : undefined, ...searchParamsOf(search) };
  const sortHrefs = Object.fromEntries(
    SORT_FIELDS.map((field) => {
      const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
      return [field, buildListHref("/parcels", filter, { sort: `${field}_${nextDir}` })];
    }),
  ) as Record<string, string>;
  const sort = params.sort;

  const rows: ParcelRow[] = parcels.map((p) => {
    const t = p.tracking;
    const shipped = p.status === "SHIPPED";
    const tone: NonNullable<ParcelRow["tracking"]>["tone"] =
      t?.problem && shipped ? "problem" : t?.status === "Delivered" ? "done" : t?.registeredAt ? "on" : "none";
    const label = t?.registeredAt ? trackingStatusLabel(t.status, t.subStatus) : t?.error ? "Не на слежении" : null;
    const hint = [t?.error, t?.event, t?.location, t?.eventAt ? formatDateTime(t.eventAt) : null].filter(Boolean).join(" · ") || null;
    return {
      id: p.id,
      createdAtLabel: formatDateTime(p.createdAt),
      trackingNumber: p.trackingNumber,
      taskNumber: p.parcelTask?.number ?? null,
      customerCode: p.customer.code,
      status: p.status,
      recipientName: p.recipient?.name ?? null,
      deliveryLabel: deliveryTypeLabel(p.deliveryType),
      ordersCount: p._count.orders,
      weightKg: Number(p.billableWeightKg ?? 0),
      totalUsd: Number(p.totalUsd),
      isPaid: p.isPaid,
      tracking: label ? { label, tone: t?.error && !t.registeredAt ? "problem" : tone, hint } : null,
    };
  });

  return (
    <Form
      formKey="parcels"
      title="Посылки"
      commands={
        <>
          <Link
            href={buildListHref("/parcels", { sort, ...searchParamsOf(search) }, { tracking: onlyProblems ? null : "problem" })}
            className={`cmd${onlyProblems ? " cmd--on" : ""}`}
            data-command="tracking-problems"
            aria-pressed={onlyProblems}
            title="Отправленные посылки, по которым отслеживание сообщило о проблеме: возврат, не вручена, таможня, нет данных"
          >
            <AlertTriangle size={15} />
            Требуют внимания{problemCount ? ` (${problemCount})` : ""}
          </Link>
          <StatusByTracks />
        </>
      }
      search={{ fields: clientFields(SEARCH_FIELDS) }}
      footer={
        <>
          {total > parcels.length ? `Показаны ${parcels.length} из ${total} — уточните поиск (Ctrl+F)` : `${total} посылок`}
          {onlyProblems ? " требуют внимания" : ""} · отметьте посылки слева, чтобы поставить статус сразу нескольким
        </>
      }
    >
      <ParcelsTable rows={rows} sortHrefs={sortHrefs} sortField={sortField} sortDir={sortDir} />
      <style>{`.cmd--on { background: #fde7b8; border-color: #e0a84a; }`}</style>
    </Form>
  );
}
