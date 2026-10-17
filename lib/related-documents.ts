// «Связанные документы» — как в 1С: дерево документов вокруг заказа или посылки.
// Цепочка — docs/product/документооборот.md, раздел 1. Ветки без документов не показываются.
import type { ParcelTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { orderStatusLabel, parcelStatusLabel } from "@/lib/statuses";

export type RelatedDoc = "order" | "parcel";

export type RelatedNode = {
  key: string;
  kind: string; // вид документа: «Заказ», «Посылка», «Сборка»…
  number: string | null;
  date: Date;
  note?: string; // статус, сумма, трек
  href?: string; // окно документа, если оно есть
  current?: boolean; // документ, из которого открыли
  deleted?: boolean; // помечен на удаление
  children: RelatedNode[];
};

export type RelatedTree = { title: string; roots: RelatedNode[] };

const TASK_STATUS_LABELS: Record<ParcelTaskStatus, string> = {
  NEW: "Создана",
  IN_PROGRESS: "В работе",
  ASSEMBLED: "Собрана",
  PACKED: "Упакована",
  WEIGHED: "Взвешена",
  COMPLETED: "Посылка сформирована",
  CANCELED: "Отменена",
};

type Base = { id: string; number: string | null; createdAt: Date; deletedAt?: Date | null };

function node(kind: string, doc: Base, extra: Partial<RelatedNode> = {}, children: RelatedNode[] = []): RelatedNode {
  return {
    key: `${kind}:${doc.id}`,
    kind,
    number: doc.number,
    date: doc.createdAt,
    deleted: Boolean(doc.deletedAt),
    children,
    ...extra,
  };
}

const money = (value: unknown) => `на сумму ${formatNumber(Number(value))}`;

// Заказ с его документами по коробке: сортировка, приём (и раскладка).
async function orderBranch(orderId: string, current: string | null, withTask: boolean): Promise<RelatedNode | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { sorting: true, receiving: { include: { placement: true } } },
  });
  if (!order) return null;
  const children: RelatedNode[] = [];
  if (order.sorting) children.push(node("Сортировка", order.sorting));
  if (order.receiving) {
    const placement = order.receiving.placement;
    children.push(node("Приём заказа", order.receiving, {}, placement ? [node("Раскладка", placement)] : []));
  }
  if (withTask && order.parcelTaskId) {
    const task = await taskBranch(order.parcelTaskId, current);
    if (task) children.push(task);
  }
  return node(
    "Заказ",
    order,
    {
      note: [order.trackNumber, orderStatusLabel(order.status)].filter(Boolean).join(" · "),
      href: `/orders/${order.id}/edit`,
      current: current === `Заказ:${order.id}`,
    },
    children
  );
}

// Задача на формирование посылки: сборка, упаковка, взвешивание, посылка со всем, что после неё.
async function taskBranch(taskId: string, current: string | null): Promise<RelatedNode | null> {
  const task = await prisma.parcelTask.findUnique({
    where: { id: taskId },
    include: { assembly: true, packing: true, weighing: true, parcel: { select: { id: true } } },
  });
  if (!task) return null;
  const children: RelatedNode[] = [];
  if (task.assembly) children.push(node("Сборка", task.assembly));
  if (task.packing) children.push(node("Упаковка", task.packing));
  if (task.weighing) children.push(node("Взвешивание", task.weighing, { note: `${formatNumber(Number(task.weighing.weightKg))} кг` }));
  if (task.parcel) {
    const parcel = await parcelBranch(task.parcel.id, current);
    if (parcel) children.push(parcel);
  }
  return node("Задача на формирование посылки", task, { note: TASK_STATUS_LABELS[task.status] }, children);
}

// Посылка: изменения статуса, короб → реестр → AWB → счета агентов → выплаты, оплаты клиента, долг.
async function parcelBranch(parcelId: string, current: string | null): Promise<RelatedNode | null> {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    include: {
      statusHistory: { orderBy: { createdAt: "asc" } },
      box: { include: { manifest: { include: { awbs: { include: { invoices: { include: { payouts: true } } } } } } } },
      allocationItems: { include: { allocation: { include: { payment: { include: { topUpRequest: true } } } } } },
      ledgerEntries: true,
    },
  });
  if (!parcel) return null;
  const children: RelatedNode[] = parcel.statusHistory.map((change) => ({
    key: `status:${change.id}`,
    kind: "Изменение статуса",
    number: null,
    date: change.createdAt,
    note: parcelStatusLabel(change.status),
    children: [],
  }));

  if (parcel.box) {
    const manifest = parcel.box.manifest;
    const awbs = (manifest?.awbs ?? []).map((awb) =>
      node(
        "Документы AWB",
        awb,
        {},
        awb.invoices.map((invoice) =>
          node(
            "Счёт на оплату услуг",
            invoice,
            { note: money(invoice.amount) },
            invoice.payouts.map((payout) => node("Заявка на выплату агенту (подрядчику)", payout, { note: money(payout.amount) }))
          )
        )
      )
    );
    children.push(node("Комплектация коробов", parcel.box, {}, manifest ? [node("Реестр отправки", manifest, {}, awbs)] : []));
  }

  // Оплаты клиента: заявка на пополнение → приход ДС → распределение по посылкам (как в 1С).
  for (const item of parcel.allocationItems) {
    const allocation = node("Распределение оплат по посылкам", item.allocation, { note: money(item.amount) });
    const payment = node("Приход ДС", item.allocation.payment, { note: money(item.allocation.payment.amount) }, [allocation]);
    const request = item.allocation.payment.topUpRequest;
    children.push(request ? node("Заявка на пополнение баланса клиента", request, { note: money(request.amount) }, [payment]) : payment);
  }

  for (const entry of parcel.ledgerEntries) children.push(node("Изменение долга клиента", entry, { note: money(entry.amount) }));

  return node(
    "Посылка",
    parcel,
    {
      note: [parcel.trackingNumber, parcelStatusLabel(parcel.status)].filter(Boolean).join(" · "),
      href: `/parcels/${parcel.id}`,
      current: current === `Посылка:${parcel.id}`,
    },
    children
  );
}

// Дерево для окна «Связанные документы». Из заказа — заказ и всё, что из него выросло.
// Из посылки — заказы задачи (основания) и задача с посылкой.
export async function relatedTree(doc: RelatedDoc, id: string): Promise<RelatedTree | null> {
  if (doc === "order") {
    const order = await prisma.order.findUnique({ where: { id }, select: { number: true, trackNumber: true } });
    const root = order && (await orderBranch(id, `Заказ:${id}`, true));
    if (!order || !root) return null;
    return { title: `Заказ ${order.number ?? ""}${order.trackNumber ? ` (${order.trackNumber})` : ""}`, roots: [root] };
  }

  const parcel = await prisma.parcel.findUnique({
    where: { id },
    select: { id: true, number: true, trackingNumber: true, parcelTaskId: true, orders: { select: { id: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!parcel) return null;
  const current = `Посылка:${parcel.id}`;
  const orders = (await Promise.all(parcel.orders.map((order) => orderBranch(order.id, current, false)))).filter(
    (branch): branch is RelatedNode => branch !== null
  );
  const tail = parcel.parcelTaskId ? await taskBranch(parcel.parcelTaskId, current) : await parcelBranch(parcel.id, current);
  return {
    title: `Посылка ${parcel.number}${parcel.trackingNumber ? ` (${parcel.trackingNumber})` : ""}`,
    roots: tail ? [...orders, tail] : orders,
  };
}

export function relatedLine(node: RelatedNode) {
  return [node.kind, node.number, `от ${formatDateTime(node.date)}`].filter(Boolean).join(" ");
}
