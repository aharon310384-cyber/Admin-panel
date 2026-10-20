import type { Metadata } from "next";
import { auth } from "@/auth";
import { getFinanceSettings, getRateHistory, getRatesStats } from "@/lib/finance";
import RatesTab from "./rates-tab";
import Form from "@/components/form/form";

export const metadata: Metadata = { title: "Курс" };

export default async function FinancePage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const settings = await getFinanceSettings();
  const [ratesData, history] = await Promise.all([getRatesStats(settings.exchangeRateCnyPerUsd), getRateHistory()]);

  return (
    <Form formKey="finance" title="Курс" footer="Курс CNY / USD по умолчанию для новых посылок">
      <RatesTab settings={settings} stats={ratesData} history={history} isAdmin={isAdmin} />
    </Form>
  );
}
