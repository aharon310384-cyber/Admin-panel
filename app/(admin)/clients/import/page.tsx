import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Form from "@/components/form/form";
import ClientsImport from "@/components/clients/clients-import";

export const metadata: Metadata = { title: "Клиенты из Excel" };

// Список клиентов из файла Excel: план → «Применить» (actions/clients-import.ts).
export default async function ClientsImportPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/clients");
  return (
    <Form
      formKey="clients-import"
      title="Клиенты из Excel"
      footer={<>Файл обновляет список клиентов: новые добавляются, у остальных меняется то, что заполнено в файле. Клиентам ничего не отправляется.</>}
    >
      <ClientsImport />
    </Form>
  );
}
