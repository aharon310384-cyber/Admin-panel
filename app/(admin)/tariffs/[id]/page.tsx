import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateShippingTariff } from "@/actions/tariffs";
import { countryNames, tariffFormOptions } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";
import Form from "@/components/form/form";
import TariffForm from "../tariff-form";

export const metadata: Metadata = { title: "Тариф" };

export default async function TariffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const tariff = await prisma.shippingTariff.findUnique({ where: { id } });
  if (!tariff) notFound();
  const [options, names] = await Promise.all([tariffFormOptions(), countryNames()]);
  const number = (value: { toString(): string } | null) => (value == null ? "" : String(Number(value)));

  return (
    <Form formKey="tariff" title={[tariff.direction, tariff.cargoType].filter(Boolean).join(", ")} footer={<>Изменён {formatDateTime(tariff.updatedAt)}</>}>
      <TariffForm
        values={{
          id: tariff.id,
          companyId: tariff.companyId ?? options.companies[0]?.value ?? "",
          section: tariff.section ?? "",
          direction: tariff.direction,
          countries: tariff.countryCodes.map((code) => names.get(code) ?? code).join(", "),
          deliveryType: tariff.deliveryType,
          cargoType: tariff.cargoType ?? "",
          deliveryTarget: tariff.deliveryTarget ?? "",
          pricePerKgUsd: number(tariff.pricePerKgUsd),
          handlingFeeUsd: number(tariff.handlingFeeUsd),
          minDays: tariff.minDays?.toString() ?? "",
          maxDays: tariff.maxDays?.toString() ?? "",
          volumetricDivisor: tariff.volumetricDivisor?.toString() ?? "",
          sortOrder: String(tariff.sortOrder),
          paymentTiming: tariff.paymentTiming,
          onRequest: tariff.onRequest,
          active: tariff.active,
        }}
        {...options}
        action={updateShippingTariff.bind(null, tariff.id)}
        isAdmin={session?.user.role === "ADMIN"}
      />
    </Form>
  );
}
