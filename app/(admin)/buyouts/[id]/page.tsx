import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatDateTime } from "@/lib/utils";
import { BUYOUT_KIND_LABELS, BUYOUT_RETURN_KIND_LABELS, BUYOUT_STATUS_COLOR, ORDER_STATUS_COLOR, buyoutStatusLabel, orderStatusLabel } from "@/lib/statuses";
import { round2, yuan } from "@/lib/buyout-money";
import { clientBalance, LEDGER_REASON_LABELS } from "@/lib/balance";
import { readAttachments } from "@/lib/buyout-files";
import { getBuyoutSettings, syncBuyoutsAtWarehouse } from "@/lib/buyouts";
import Form from "@/components/form/form";
import BuyoutActions from "@/components/buyouts/buyout-actions";
import { BUYOUT_ADMIN_CSS } from "@/components/buyouts/admin-styles";

export const metadata: Metadata = { title: "Выкуп" };

// Карточка выкупа (docs/product/задание-выкуп.md, раздел 5): все поля, вложения, деньги, история;
// справа — кнопки по статусу. «Связанные документы» (Ctrl+Shift+S): выкуп → заказ → задача → посылка.

const dash = (value: string | null | undefined) => value?.trim() || "—";
const n = (value: unknown) => (value == null ? null : Number(value));

export default async function BuyoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await syncBuyoutsAtWarehouse({ id });
  const [buyout, session, settings] = await Promise.all([
    prisma.buyout.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, code: true, name: true, telegramChatId: true } },
        createdBy: { select: { name: true } },
        order: { select: { id: true, number: true, status: true, trackNumber: true, parcelTask: { select: { id: true, number: true } } } },
        statusHistory: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true } } } },
        ledgerEntries: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      },
    }),
    auth(),
    getBuyoutSettings(),
  ]);
  if (!buyout) notFound();
  const balance = await clientBalance(buyout.customerId);
  const attachments = readAttachments(buyout.attachments);
  const total = n(buyout.totalCny);
  const paidToSeller = n(buyout.paidToSellerCny);
  const margin = total != null && paidToSeller != null ? round2(total - paidToSeller) : null;
  const paidNet = round2(buyout.ledgerEntries.reduce((sum, entry) => sum + Number(entry.amount), 0));

  return (
    <>
      <Form
        formKey="buyout"
        guid={buyout.id}
        title={buyout.number}
        titleExtra={
          <>
            <span className={`st st--${BUYOUT_STATUS_COLOR[buyout.status]}`}>{buyoutStatusLabel(buyout.status)}</span>
            {buyout.deletedAt && <span className="st st--canceled">помечен на удаление</span>}
          </>
        }
        footer={<>Выкуп {BUYOUT_KIND_LABELS[buyout.kind].toLowerCase()} · создан {formatDateTime(buyout.createdAt)} · связанные документы — Ctrl+Shift+S</>}
      >
        <div className="bo-grid">
          <div className="bo-col">
            <section className="card card--pad">
              <h2 className="card-title">Заявка</h2>
              <dl className="bo-dl">
                <dt>Клиент</dt>
                <dd>
                  <Link href={`/clients/${buyout.customer.id}`}>{buyout.customer.code ? `${buyout.customer.code} — ` : ""}{buyout.customer.name}</Link>
                  {!buyout.customer.telegramChatId && <span className="muted"> · Telegram не привязан — сообщения не придут</span>}
                </dd>
                <dt>Баланс клиента</dt><dd>{yuan(balance)}</dd>
                <dt>Вид</dt><dd>{BUYOUT_KIND_LABELS[buyout.kind]}</dd>
                {buyout.url && (<><dt>Ссылка</dt><dd><a href={buyout.url} target="_blank" rel="noopener noreferrer nofollow">{buyout.url}</a></dd></>)}
                {buyout.sellerContact && (<><dt>Контакт продавца</dt><dd className="pre">{buyout.sellerContact}</dd></>)}
                <dt>Товар</dt><dd>{buyout.productName}</dd>
                <dt>Вариант</dt><dd>{dash(buyout.variant)}</dd>
                <dt>Количество</dt><dd>{buyout.quantity}</dd>
                <dt>Комментарий клиента</dt><dd className="pre">{dash(buyout.customerComment)}</dd>
                <dt>Автор</dt><dd>{buyout.createdBy?.name ?? "клиент из кабинета"}</dd>
                <dt>Изменён</dt><dd>{formatDateTime(buyout.updatedAt)}</dd>
              </dl>
              {attachments.length > 0 && (
                <>
                  <h3 className="card-title" style={{ marginTop: 12 }}>Вложения клиента</h3>
                  <div className="bo-files">
                    {attachments.map((file) => (
                      <a key={file.url} href={file.url} target="_blank" rel="noopener noreferrer" title={file.name}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- закрытые файлы: отдаёт /api/buyouts/files с проверкой доступа */}
                        <img src={file.url} alt={file.name} />
                      </a>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="card card--pad">
              <h2 className="card-title">Деньги, ¥</h2>
              {total == null ? (
                <p className="muted">Цена ещё не назначена.</p>
              ) : (
                <table className="bo-money" style={{ width: "100%" }}>
                  <tbody>
                    <tr><td>Товар: {yuan(buyout.unitPriceCny)} × {buyout.quantity}</td><td>{yuan(buyout.goodsCny)}</td></tr>
                    <tr><td>Доставка по Китаю до склада</td><td>{yuan(buyout.chinaDeliveryCny)}</td></tr>
                    <tr>
                      <td>Комиссия{buyout.commissionManual ? " (поправлена вручную)" : buyout.commissionPercent != null ? ` (${Number(buyout.commissionPercent)}%)` : ""}</td>
                      <td>{yuan(buyout.commissionCny)}</td>
                    </tr>
                    <tr className="total"><td>Итого клиенту</td><td>{yuan(total)}</td></tr>
                    <tr><td className="muted">Фактически заплачено продавцу</td><td className="muted">{paidToSeller != null ? yuan(paidToSeller) : "—"}</td></tr>
                    {margin != null && <tr><td className="muted">Наша разница</td><td className="muted">{yuan(margin)}</td></tr>}
                    <tr><td className="muted">Сейчас списано с баланса</td><td className="muted">{yuan(paidNet)}</td></tr>
                  </tbody>
                </table>
              )}
            </section>

            <section className="card card--pad">
              <h2 className="card-title">Ход выкупа</h2>
              <dl className="bo-dl">
                <dt>Трек продавца</dt><dd className="mono">{dash(buyout.sellerTrack)}</dd>
                <dt>Заказ</dt>
                <dd>
                  {buyout.order ? (
                    <>
                      <Link href={`/orders/${buyout.order.id}/edit`} className="mono">{buyout.order.number}</Link>{" "}
                      <span className={`st st--${ORDER_STATUS_COLOR[buyout.order.status]}`}>{orderStatusLabel(buyout.order.status)}</span>
                      {buyout.order.parcelTask && <> · задача <Link href={`/tasks/${buyout.order.parcelTask.id}`} className="mono">{buyout.order.parcelTask.number}</Link></>}
                    </>
                  ) : "создаётся, когда вписан трек продавца"}
                </dd>
                {buyout.rejectReason && (<><dt>Причина отказа</dt><dd>{buyout.rejectReason}</dd></>)}
                {buyout.returnKind && (<><dt>Возврат</dt><dd>{BUYOUT_RETURN_KIND_LABELS[buyout.returnKind]}{n(buyout.returnCostCny) ? ` · расходы ${yuan(buyout.returnCostCny)}` : ""}</dd></>)}
                {buyout.refundCny != null && (<><dt>Возвращено на баланс</dt><dd>{yuan(buyout.refundCny)}</dd></>)}
              </dl>
            </section>

            {buyout.ledgerEntries.length > 0 && (
              <section className="card card--pad">
                <h2 className="card-title">Баланс клиента по выкупу</h2>
                <ul className="bo-history">
                  {buyout.ledgerEntries.map((entry) => (
                    <li key={entry.id}>
                      <span className="muted">{formatDateTime(entry.createdAt)}</span>
                      <span>
                        <span className="mono">{entry.number}</span> · {LEDGER_REASON_LABELS[entry.reason]}:{" "}
                        <b>{Number(entry.amount) > 0 ? `−${yuan(entry.amount)}` : `+${yuan(-Number(entry.amount))}`}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="card card--pad">
              <h2 className="card-title">История</h2>
              <ul className="bo-history">
                {buyout.statusHistory.map((h) => (
                  <li key={h.id}>
                    <span className="muted">{formatDateTime(h.createdAt)}</span>
                    <span>
                      <b>{buyoutStatusLabel(h.status)}</b>
                      {h.note ? ` — ${h.note}` : ""}
                      <span className="muted"> · {h.changedBy?.name ?? (h.byClient ? "клиент" : "программа")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="bo-col">
            <BuyoutActions
              id={buyout.id}
              status={buyout.status}
              deleted={Boolean(buyout.deletedAt)}
              isAdmin={session?.user.role === "ADMIN"}
              hasOrder={Boolean(buyout.order)}
              orderLocked={Boolean(buyout.order && !["NEW", "IN_RECEIVING_QUEUE"].includes(buyout.order.status))}
              price={{
                productName: buyout.productName,
                variant: buyout.variant ?? "",
                quantity: buyout.quantity,
                unitPriceCny: n(buyout.unitPriceCny),
                chinaDeliveryCny: n(buyout.chinaDeliveryCny),
                commissionCny: n(buyout.commissionCny),
                commissionManual: buyout.commissionManual,
              }}
              money={{ total, goods: n(buyout.goodsCny), commission: n(buyout.commissionCny), paidNet }}
              rule={{ percent: settings.commissionPercent, minCny: settings.commissionMinCny }}
              rejectReasons={settings.rejectReasons}
              sellerTrack={buyout.sellerTrack ?? ""}
              notes={{
                internalComment: buyout.internalComment ?? "",
                paidToSellerCny: paidToSeller != null ? String(paidToSeller) : "",
                photoUrl: buyout.photoUrl ?? "",
              }}
            />
          </div>
        </div>
      </Form>
      <style>{BUYOUT_ADMIN_CSS}</style>
    </>
  );
}
