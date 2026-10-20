import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { deliveryTypesByCountry, serviceHints } from "@/lib/tariffs";
import OrderBulkImport from "@/components/orders/order-bulk-import";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Новый заказ" };

export default async function NewOrderPage() {
  const [customers, recipients, productNames, countries, deliveryTypes, hints] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.recipient.findMany({
      where: { deletedAt: null },
      select: { id: true, customerId: true, name: true, country: true, countryCode: true },
      orderBy: { name: "asc" },
    }),
    prisma.productName.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, nameRu: true, category: true, hsCode: true },
      orderBy: { nameRu: "asc" },
    }),
    prisma.country.findMany({
      select: { code: true, nameRu: true },
      orderBy: { nameRu: "asc" },
    }),
    deliveryTypesByCountry(),
    serviceHints(),
  ]);

  return (
    <Form
      formKey="orders-new"
      title="Новый заказ"
      footer={<>Один заказ = один товар + один входящий трек-номер. Несколько входящих трек-номеров — несколько заказов.</>}
    >
      <OrderBulkImport customers={customers} recipients={recipients} productNames={productNames} countries={countries} deliveryTypesByCountry={deliveryTypes} serviceHints={hints} />
    </Form>
  );
}
