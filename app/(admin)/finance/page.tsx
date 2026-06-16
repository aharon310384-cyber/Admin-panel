import type { Metadata } from "next";
import Link from "next/link";
import { CircleDollarSign, Receipt } from "lucide-react";
import { auth } from "@/auth";
import {
  getFinanceSettings,
  getPaymentsRegistry,
  getRatesStats,
  type PaymentsFilter,
} from "@/lib/finance";
import { parsePageParam } from "@/lib/list-params";
import RatesTab from "./rates-tab";
import PaymentsTab from "./payments-tab";

export const metadata: Metadata = { title: "Финансы" };

type TabKey = "rates" | "payments";

type SearchParams = {
  tab?: string;
  page?: string;
  paid?: string;
};

const TABS: Array<{ key: TabKey; label: string; icon: typeof CircleDollarSign; description: string }> = [
  {
    key: "rates",
    label: "Курс",
    icon: CircleDollarSign,
    description: "Курс CNY / USD по умолчанию для новых посылок",
  },
  {
    key: "payments",
    label: "Расчёт и оплата",
    icon: Receipt,
    description: "Сводка расчётов по посылкам и статус оплаты",
  },
];

function parseTab(raw: string | undefined): TabKey {
  return raw === "payments" ? "payments" : "rates";
}

function parsePaidFilter(raw: string | undefined): PaymentsFilter {
  if (raw === "paid") return "paid";
  if (raw === "unpaid") return "unpaid";
  return "all";
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const settings = await getFinanceSettings();

  const ratesData = tab === "rates" ? await getRatesStats(settings.exchangeRateCnyPerUsd) : null;

  const paymentsPage = parsePageParam(params.page);
  const paymentsFilter = parsePaidFilter(params.paid);
  const paymentsData =
    tab === "payments"
      ? await getPaymentsRegistry({ page: paymentsPage, filter: paymentsFilter })
      : null;

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Справочник</p>
          <h1 className="page-title">Финансы</h1>
          <p className="page-subtitle">{activeTab.description}</p>
        </div>
      </div>

      <nav className="tabs" aria-label="Регистры финансов">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={key === "rates" ? "/finance" : `/finance?tab=${key}`}
            className={`tab ${tab === key ? "tab--active" : ""}`}
            aria-current={tab === key ? "page" : undefined}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {tab === "rates" && ratesData && (
        <RatesTab settings={settings} stats={ratesData} isAdmin={isAdmin} />
      )}

      {tab === "payments" && paymentsData && (
        <PaymentsTab data={paymentsData} filter={paymentsFilter} />
      )}

      <style>{`
        .page { display: flex; flex-direction: column; gap: 20px; }
        .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-eyebrow { margin: 0 0 4px; color: var(--color-accent); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .page-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--color-text); letter-spacing: -0.02em; }
        .page-subtitle { font-size: 13px; color: var(--color-muted); margin: 6px 0 0; max-width: 640px; }

        .tabs {
          display: inline-flex;
          gap: 4px;
          padding: 4px;
          background: var(--color-muted-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          align-self: flex-start;
        }
        .tab {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          background: transparent;
          border-radius: calc(var(--radius-md) - 4px);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        .tab:hover { color: var(--color-text); }
        .tab--active {
          background: var(--color-surface);
          color: var(--color-text);
          box-shadow: var(--shadow-card);
        }
      `}</style>
    </div>
  );
}
