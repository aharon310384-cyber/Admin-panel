import type { Metadata } from "next";
import {
  getPaymentsRegistry,
  PAYMENTS_SORT_FIELDS,
  type PaymentsFilter,
} from "@/lib/finance";
import { parsePageParam, parseSortParam } from "@/lib/list-params";
import PaymentsTab from "../finance/payments-tab";

export const metadata: Metadata = { title: "Расчёт и оплата" };

type SearchParams = {
  page?: string;
  paid?: string;
  sort?: string;
};

function parsePaidFilter(raw: string | undefined): PaymentsFilter {
  if (raw === "paid") return "paid";
  if (raw === "unpaid") return "unpaid";
  return "all";
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const filter = parsePaidFilter(params.paid);
  const [sortField, sortDir] = parseSortParam(params.sort, PAYMENTS_SORT_FIELDS, "createdAt", "desc");
  const data = await getPaymentsRegistry({ page, filter, sortField, sortDir });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Регистр</p>
          <h1 className="page-title">Расчёт и оплата</h1>
          <p className="page-subtitle">Сводка расчётов по посылкам и статус оплаты</p>
        </div>
      </div>

      <PaymentsTab data={data} filter={filter} sortField={sortField} sortDir={sortDir} />

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
