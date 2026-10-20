import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createShippingTariff } from "@/actions/tariffs";
import { clientCompanyId, tariffFormOptions } from "@/lib/tariffs";
import Form from "@/components/form/form";
import TariffForm from "../tariff-form";

export const metadata: Metadata = { title: "Новый тариф" };

export default async function NewTariffPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/tariffs");
  const params = await searchParams;
  const [options, clientId] = await Promise.all([tariffFormOptions(), clientCompanyId()]);
  const companyId = options.companies.find((company) => company.value === params.company)?.value ?? clientId ?? options.companies[0]?.value ?? "";

  return (
    <Form formKey="tariff-new" title="Новый тариф">
      <TariffForm
        values={{
          companyId,
          section: "",
          direction: "",
          countries: "",
          deliveryType: options.deliveryMethods[0]?.value ?? "",
          cargoType: "",
          deliveryTarget: "",
          pricePerKgUsd: "",
          handlingFeeUsd: "",
          minDays: "",
          maxDays: "",
          volumetricDivisor: "",
          sortOrder: "0",
          paymentTiming: "BEFORE",
          onRequest: false,
          active: true,
        }}
        {...options}
        action={createShippingTariff}
        isAdmin
      />
    </Form>
  );
}
