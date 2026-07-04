import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import OrdersSelectTable, { type OrderRow } from "@/components/orders/orders-select-table";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";

export const metadata: Metadata = { title: "Заказы" };

const SORT_FIELDS = [
  "customerCode",
  "productNameText",
  "trackNumber",
  "quantity",
  "unitPriceUsd",
  "declaredValueUsd",
  "actualWeightKg",
  "deliveryType",
  "recipientName",
  "status",
  "createdAt",
] as const;
type SortField = (typeof SORT_FIELDS)[number];

function orderOrderBy(field: SortField, dir: SortDirection): Prisma.OrderOrderByWithRelationInput {
  switch (field) {
    case "customerCode":
      return { customer: { code: dir } };
    case "recipientName":
      return { recipient: { name: dir } };
    case "productNameText":
      return { productNameText: dir };
    case "trackNumber":
      return { trackNumber: dir };
    case "quantity":
      return { quantity: dir };
    case "unitPriceUsd":
      return { unitPriceUsd: dir };
    case "declaredValueUsd":
      return { declaredValueUsd: dir };
    case "actualWeightKg":
      return { actualWeightKg: dir };
    case "deliveryType":
      return { deliveryType: dir };
    case "status":
      return { status: dir };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const [sortField, sortDir] = parseSortParam(params.sort, SORT_FIELDS, "createdAt", "desc");

  const orders = await prisma.order.findMany({
    where: { deletedAt: null },
    include: { customer: true, recipient: true },
    orderBy: orderOrderBy(sortField, sortDir),
    take: 200,
  });

  const sortHref = (field: SortField) => {
    const nextDir = sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return buildListHref("/orders", {}, { sort: `${field}_${nextDir}` });
  };
  const sortHrefs = Object.fromEntries(
    SORT_FIELDS.map((f) => [f, sortHref(f)]),
  ) as Record<string, string>;

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    customerId: o.customerId,
    customerCode: o.customer.code,
    recipientId: o.recipientId,
    recipientName: o.recipient?.name ?? null,
    productNameText: o.productNameText,
    trackNumber: o.trackNumber,
    customerComment: o.customerComment,
    quantity: o.quantity,
    unitPriceUsd: o.unitPriceUsd != null ? Number(o.unitPriceUsd) : null,
    declaredValueUsd: o.declaredValueUsd != null ? Number(o.declaredValueUsd) : null,
    actualWeightKg: o.actualWeightKg != null ? Number(o.actualWeightKg) : null,
    deliveryType: o.deliveryType,
    status: o.status,
    parcelId: o.parcelId,
    createdAtLabel: formatDateTime(o.createdAt),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Заказы</h1>
          <p className="page-subtitle">{orders.length} заказов · отметьте принятые → «Оформить на отправку»</p>
        </div>
        <Link href="/orders/new" className="btn-add">
          <Plus size={16} />
          Добавить заказ
        </Link>
      </div>

      <OrdersSelectTable orders={rows} sortHrefs={sortHrefs} sortField={sortField} sortDir={sortDir} />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 4px 0 0; }
        .btn-add { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; background: var(--color-accent); border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: #fff; text-decoration: none; white-space: nowrap; transition: opacity 0.15s; }
        .btn-add:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
}
