import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { deliveryTypeLabel } from "@/lib/statuses";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";
import { trackingStatusLabel } from "@/lib/tracking-labels";
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

export default async function ParcelsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tracking?: string }>;
}) {
  const params = await searchParams;
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");
  const onlyProblems = params.tracking === "problem";
  // «Требуют внимания»: отправленные, по которым 17TRACK сообщил о проблеме
  const problemWhere: Prisma.ParcelWhereInput = { status: "SHIPPED", tracking: { problem: true } };

  const [parcels, problemCount] = await Promise.all([
    prisma.parcel.findMany({
      where: { deletedAt: null, ...(onlyProblems ? problemWhere : {}) },
      include: {
        customer: { select: { name: true, code: true } },
        recipient: { select: { name: true } },
        parcelTask: { select: { number: true } },
        tracking: { select: { status: true, subStatus: true, problem: true, registeredAt: true, error: true, event: true, location: true, eventAt: true } },
        _count: { select: { orders: true } },
      },
      orderBy: parcelOrderBy(sortField, sortDir),
      take: 200,
    }),
    prisma.parcel.count({ where: { deletedAt: null, ...problemWhere } }),
  ]);

  const filter = { tracking: onlyProblems ? "problem" : undefined };
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
            href={buildListHref("/parcels", { sort }, { tracking: onlyProblems ? null : "problem" })}
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
      footer={<>{parcels.length} посылок{onlyProblems ? " требуют внимания" : ""} · отметьте посылки слева, чтобы поставить статус сразу нескольким</>}
    >
      <ParcelsTable rows={rows} sortHrefs={sortHrefs} sortField={sortField} sortDir={sortDir} />
      <style>{`.cmd--on { background: #fde7b8; border-color: #e0a84a; }`}</style>
    </Form>
  );
}
