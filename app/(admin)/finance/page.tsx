import type { Metadata } from "next";
import { auth } from "@/auth";
import { getFinanceSettings, getRatesStats } from "@/lib/finance";
import RatesTab from "./rates-tab";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Курс" };

export default async function FinancePage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const settings = await getFinanceSettings();
  const ratesData = await getRatesStats(settings.exchangeRateCnyPerUsd);

  return (
    <Form formKey="finance" title="Курс" footer="Курс CNY / USD по умолчанию для новых посылок">
      <RatesTab settings={settings} stats={ratesData} isAdmin={isAdmin} />
    </Form>
  );
}
