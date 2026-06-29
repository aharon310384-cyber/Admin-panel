import type { Metadata } from "next";
import { auth } from "@/auth";
import { getFinanceSettings, getRatesStats } from "@/lib/finance";
import RatesTab from "./rates-tab";

export const metadata: Metadata = { title: "Курс" };

export default async function FinancePage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const settings = await getFinanceSettings();
  const ratesData = await getRatesStats(settings.exchangeRateCnyPerUsd);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Регистр</p>
          <h1 className="page-title">Курс</h1>
          <p className="page-subtitle">Курс CNY / USD по умолчанию для новых посылок</p>
        </div>
      </div>

      <RatesTab settings={settings} stats={ratesData} isAdmin={isAdmin} />

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-eyebrow { margin: 0 0 4px; color: var(--color-accent); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); letter-spacing: -0.02em; }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 6px 0 0; max-width: 640px; }
      `}</style>
    </div>
  );
}
