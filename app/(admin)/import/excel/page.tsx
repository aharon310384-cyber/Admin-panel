import type { Metadata } from "next";
import Form from "@/components/form/form";
import ExcelCheck from "@/components/import/excel-check";

export const metadata: Metadata = { title: "Загрузка из Excel" };

// Загрузка строк Excel в базу (docs/product/задание-excel.md). Шаг 1 — проверка ИИ-разборщика, ничего не сохраняется.
export default function ExcelImportPage() {
  return (
    <Form
      formKey="excel-import"
      title="Загрузка из Excel"
      footer={<>Шаг 1 — проверка разборщика: результат только на экране, в базу ничего не записывается. Юани в доллары — по курсу из «Финансы → Курс». Товары с одним входящим треком — одной строкой.</>}
    >
      <ExcelCheck />
    </Form>
  );
}
