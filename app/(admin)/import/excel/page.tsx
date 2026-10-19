import type { Metadata } from "next";
import Form from "@/components/form/form";
import ExcelRow from "@/components/import/excel-row";
import { prisma } from "@/lib/prisma";
import { cleanColumns } from "@/lib/excel-columns";

export const metadata: Metadata = { title: "Загрузка из Excel" };

// Загрузка строк Excel в базу (docs/product/задание-excel.md). Шаг 2 — строка целиком → заказы → задача → посылка.
export default async function ExcelImportPage() {
  const settings = await prisma.excelImportSettings.findFirst({ select: { columns: true } });
  return (
    <Form
      formKey="excel-import"
      title="Загрузка из Excel"
      footer={<>Строка Excel → заказы, задача и посылка. Клиентам ничего не отправляется. Повторная загрузка той же строки обновляет документы.</>}
    >
      <ExcelRow initialColumns={cleanColumns(settings?.columns)} />
    </Form>
  );
}
