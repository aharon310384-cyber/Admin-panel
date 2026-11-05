import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { TOP_UP_STATUS_COLOR, TOP_UP_STATUS_LABELS } from "@/lib/statuses";
import { yuan } from "@/lib/purchase-money";
import { LEDGER_REASON_LABELS, clientBalance } from "@/lib/balance";
import { getPurchaseSettings } from "@/lib/purchases";
import Form from "@/components/form/form";
import TopUpActions from "@/components/purchases/top-up-actions";
import { PURCHASE_ADMIN_CSS } from "@/components/purchases/admin-styles";

export const metadata: Metadata = { title: "Заявка на пополнение" };

const dash = (value: string | null | undefined) => value?.trim() || "—";

export default async function TopUpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [request, session, settings] = await Promise.all([
    prisma.topUpRequest.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        createdBy: { select: { name: true } },
        payments: {
          orderBy: { createdAt: "asc" },
          include: { createdBy: { select: { name: true } }, ledgerEntries: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } } } } },
        },
      },
    }),
    auth(),
    getPurchaseSettings(),
  ]);
  if (!request) notFound();
  const balance = await clientBalance(request.customerId);
  const amount = Number(request.amount);

  return (
    <>
      <Form
        formKey="top-up"
        title={request.number}
        titleExtra={<span className={`st st--${TOP_UP_STATUS_COLOR[request.status]}`}>{TOP_UP_STATUS_LABELS[request.status]}</span>}
        footer={<>Заявка на пополнение баланса клиента · создана {formatDateTime(request.createdAt)}</>}
      >
        <div className="bo-grid">
          <div className="bo-col">
            <section className="card card--pad">
              <h2 className="card-title">Заявка</h2>
              <dl className="bo-dl">
                <dt>Клиент</dt><dd><Link href={`/clients/${request.customer.id}`}>{request.customer.code ? `${request.customer.code} — ` : ""}{request.customer.name}</Link></dd>
                <dt>Баланс клиента</dt><dd>{yuan(balance)}</dd>
                <dt>Сумма</dt><dd><b>{yuan(request.amount)}</b></dd>
                <dt>Способ</dt><dd>{dash(request.method)}</dd>
                <dt>Номер платежа</dt><dd className="mono">{dash(request.reference)}</dd>
                <dt>Комментарий клиента</dt><dd className="pre">{dash(request.note)}</dd>
                <dt>Автор</dt><dd>{request.createdBy?.name ?? "клиент из кабинета"}</dd>
                {request.cancelReason && (<><dt>Причина отказа</dt><dd>{request.cancelReason}</dd></>)}
              </dl>
              {request.screenshotUrl && (
                <>
                  <h3 className="card-title" style={{ marginTop: 12 }}>Скриншот оплаты</h3>
                  <div className="bo-files">
                    <a href={request.screenshotUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- закрытый файл: отдаёт /api/purchases/files с проверкой доступа */}
                      <img src={request.screenshotUrl} alt="Скриншот оплаты" />
                    </a>
                  </div>
                </>
              )}
            </section>

            {request.payments.length > 0 && (
              <section className="card card--pad">
                <h2 className="card-title">Зачисления</h2>
                <ul className="bo-history">
                  {request.payments.flatMap((payment) => [
                    <li key={payment.id}>
                      <span className="muted">{formatDateTime(payment.createdAt)}</span>
                      <span>
                        Приход ДС <span className="mono">{payment.number}</span> · {yuan(payment.amount)} · {dash(payment.method)} · платёж{" "}
                        <span className="mono">{dash(payment.reference)}</span> · {payment.createdBy.name}
                        {payment.deletedAt && <span className="muted"> · сторнирован</span>}
                      </span>
                    </li>,
                    ...payment.ledgerEntries.map((entry) => (
                      <li key={entry.id}>
                        <span className="muted">{formatDateTime(entry.createdAt)}</span>
                        <span>
                          <span className="mono">{entry.number}</span> · {LEDGER_REASON_LABELS[entry.reason]}:{" "}
                          <b>{Number(entry.amount) < 0 ? `+${yuan(-Number(entry.amount))}` : `−${yuan(entry.amount)}`}</b> на баланс
                          {entry.createdBy ? ` · ${entry.createdBy.name}` : ""}
                        </span>
                      </li>
                    )),
                  ])}
                </ul>
              </section>
            )}
          </div>

          <div className="bo-col">
            <TopUpActions
              id={request.id}
              status={request.status}
              isAdmin={session?.user.role === "ADMIN"}
              amount={String(amount)}
              method={request.method ?? ""}
              reference={request.reference ?? ""}
              methods={settings.topUpMethods}
              confirmAbove={settings.topUpConfirmAboveCny}
            />
          </div>
        </div>
      </Form>
      <style>{PURCHASE_ADMIN_CSS}</style>
    </>
  );
}
