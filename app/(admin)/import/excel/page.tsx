import type { Metadata } from "next";
import Form from "@/components/form/form";
import ExcelRow from "@/components/import/excel-row";
import { prisma } from "@/lib/prisma";
import { cleanColumns, cleanDelivery } from "@/lib/excel-columns";

export const metadata: Metadata = { title: "Загрузка из Excel" };

// Загрузка строк Excel в базу (docs/product/задание-excel.md). Шаг 2 — строка целиком → заказы → задача → посылка.
export default async function ExcelImportPage({ searchParams }: { searchParams: Promise<{ row?: string }> }) {
  const { row } = await searchParams;
  const [settings, methods] = await Promise.all([
    prisma.excelImportSettings.findFirst({ select: { columns: true, deliveryTypes: true, deliveryDefault: true } }),
    prisma.deliveryMethod.findMany({ where: { active: true }, select: { code: true, nameRu: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const deliveryMethods = methods.map((m) => ({ code: m.code, name: m.nameRu }));
  return (
    <Form
      formKey="excel-import"
      title="Загрузка из Excel"
      footer={<>Строка Excel → заказы, задача и посылка. Клиентам ничего не отправляется. Повторная загрузка той же строки обновляет документы.</>}
    >
      <ExcelRow
        initialColumns={cleanColumns(settings?.columns)}
        initialDelivery={cleanDelivery(settings?.deliveryTypes, settings?.deliveryDefault, deliveryMethods.map((m) => m.code))}
        deliveryMethods={deliveryMethods}
        fromExcel={row?.trim().slice(0, 100) || null}
      />
    </Form>
  );
}
