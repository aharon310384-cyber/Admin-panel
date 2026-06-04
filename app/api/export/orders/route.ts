import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PARCEL_STATUS_LABELS } from "@/types";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export async function GET() {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.parcel.findMany({
    where: { deletedAt: null },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = [
    [
    "Номер посылки",
      "Получатель",
      "Email",
      "Статус",
      "Расчет USD",
      "Курс USD/CNY",
      "К оплате CNY",
      "Оплата",
      "Номер посылки",
      "Дата",
    ],
    ...orders.map((o) => [
      o.number,
      o.recipientName || o.customer.name,
      o.customer.email ?? "",
      PARCEL_STATUS_LABELS[o.status],
      Number(o.totalUsd || o.total).toFixed(2),
      Number(o.exchangeRateCnyPerUsd).toFixed(4),
      Number(o.totalCny).toFixed(2),
      o.isPaid ? "Да" : "Нет",
      o.parcelNumber ?? "",
      format(o.createdAt, "dd.MM.yyyy HH:mm", { locale: ru }),
    ]),
  ];

  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
    )
    .join("\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  });
}
