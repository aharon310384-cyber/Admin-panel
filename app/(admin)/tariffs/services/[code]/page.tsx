import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateServiceTariff } from "@/actions/tariffs";
import Form from "@/components/form/form";
import ServiceForm from "../../service-form";

export const metadata: Metadata = { title: "Услуга" };

export default async function ServicePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  const service = await prisma.serviceTariff.findUnique({ where: { code } });
  if (!service) notFound();
  const number = (value: { toString(): string } | null) => (value == null ? "" : String(Number(value)));

  return (
    <Form formKey="service" title={service.name} footer={<>Код услуги в программе: {service.code}</>}>
      <ServiceForm
        values={{
          code: service.code,
          name: service.name,
          description: service.description ?? "",
          pricingType: service.pricingType,
          value: number(service.value),
          percentMin: number(service.percentMin),
          percentMax: number(service.percentMax),
          sortOrder: String(service.sortOrder),
          inPriceList: service.inPriceList,
          active: service.active,
        }}
        action={updateServiceTariff.bind(null, service.code)}
        isAdmin={session?.user.role === "ADMIN"}
      />
    </Form>
  );
}
