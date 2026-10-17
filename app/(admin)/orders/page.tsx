import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import OrdersSelectTable, { type OrderRow } from "@/components/orders/orders-select-table";
import { parseSortParam, buildListHref, type SortDirection } from "@/lib/list-params";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Заказы" };

const SORT_FIELDS = [
  "customerCode",
  "number",
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
    case "number":
      return { number: dir };
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
    number: o.number,
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
    <Form
      formKey="orders"
      title="Заказы"
      commands={
        <Link href="/orders/new" className="cmd cmd--primary" data-command="create">
          <Plus size={15} />
          Создать
        </Link>
      }
      footer={<>{orders.length} заказов · отметьте принятые → «Оформить на отправку»</>}
    >
      <OrdersSelectTable orders={rows} sortHrefs={sortHrefs} sortField={sortField} sortDir={sortDir} />
    </Form>
  );
}
