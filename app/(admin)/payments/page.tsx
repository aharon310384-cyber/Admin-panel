import type { Metadata } from "next";
import {
  getPaymentsRegistry,
  PAYMENTS_SORT_FIELDS,
  type PaymentsFilter,
} from "@/lib/finance";
import { parsePageParam, parseSortParam } from "@/lib/list-params";
import PaymentsTab from "../finance/payments-tab";
import Form from "@/components/form/form";

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
    <Form formKey="payments" title="Расчёт и оплата" footer="Сводка расчётов по посылкам и статус оплаты">
      <PaymentsTab data={data} filter={filter} sortField={sortField} sortDir={sortDir} />
    </Form>
  );
}
