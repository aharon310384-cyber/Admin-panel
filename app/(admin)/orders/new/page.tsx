import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { deliveryTypesByCountry, serviceHints } from "@/lib/tariffs";
import { catalogItemOptions } from "@/lib/products";
import OrderBulkImport, { type BulkInitial } from "@/components/orders/order-bulk-import";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Новый заказ" };

const DELIVERY = ["AIR", "SEA", "TRAIN", "TRUCK"] as const;

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  // «+ Товар в этот трек» из карточки заказа: клиент, получатель, вид доставки и трек — как у того заказа.
  const { from } = await searchParams;
  const source = from
    ? await prisma.order.findFirst({
        where: { id: from, deletedAt: null },
        select: { customerId: true, recipientId: true, deliveryType: true, trackNumber: true },
      })
    : null;
  const initial: BulkInitial | undefined = source
    ? {
        customerId: source.customerId,
        recipientId: source.recipientId ?? undefined,
        deliveryType: DELIVERY.find((d) => d === source.deliveryType),
        trackNumber: source.trackNumber ?? undefined,
      }
    : undefined;

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
    catalogItemOptions(),
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
      footer={<>Один заказ = один товар + один входящий трек-номер. Несколько товаров в одной коробке — «+ Ещё товар в этот трек»: заказы с одним треком.</>}
    >
      <OrderBulkImport customers={customers} recipients={recipients} productNames={productNames} countries={countries} deliveryTypesByCountry={deliveryTypes} serviceHints={hints} initial={initial} />
    </Form>
  );
}
