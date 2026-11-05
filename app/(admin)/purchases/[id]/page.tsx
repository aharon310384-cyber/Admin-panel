import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatDateTime } from "@/lib/utils";
import {
  ORDER_STATUS_COLOR,
  PARCEL_STATUS_COLOR,
  PURCHASE_LINE_KIND_LABELS,
  PURCHASE_LINE_STATUS_COLOR,
  PURCHASE_LINE_STATUS_LABELS,
  PURCHASE_MODE_LABELS,
  PURCHASE_RETURN_KIND_LABELS,
  PURCHASE_STATUS_COLOR,
  orderStatusLabel,
  parcelStatusLabel,
  purchaseStatusLabel,
} from "@/lib/statuses";
import { duration, round2, yuan } from "@/lib/purchase-money";
import { marketplaceLabel, shortHost } from "@/lib/purchase-lines";
import { clientBalance, LEDGER_REASON_LABELS } from "@/lib/balance";
import { readAttachments } from "@/lib/purchase-files";
import { getPurchaseSettings, purchasePaidNet, syncPurchases } from "@/lib/purchases";
import { purchaseFormOptions, PURCHASE_SERVICE_FIELDS } from "@/lib/purchase-options";
import Form from "@/components/form/form";
import PurchaseActions from "@/components/purchases/purchase-actions";
import PurchaseLineActions from "@/components/purchases/purchase-line-actions";
import { PURCHASE_ADMIN_CSS, PURCHASE_CARD_CSS } from "@/components/purchases/admin-styles";

export const metadata: Metadata = { title: "Покупка" };

// Карточка покупки (docs/product/задание-выкуп.md, раздел 8): шапка, строки, цена по частям, деньги, время шагов,
// связанные заказы и посылка; кнопки по статусу. «Связанные документы» (Ctrl+Shift+S): покупка → заказы → задача → посылка.

const dash = (value: string | null | undefined) => value?.trim() || "—";
const n = (value: unknown) => (value == null ? null : Number(value));

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await syncPurchases({ id });
  const [purchase, session, settings] = await Promise.all([
    prisma.purchase.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, code: true, name: true, telegramChatId: true } },
        createdBy: { select: { name: true } },
        recipient: { select: { id: true, name: true, city: true, address: true } },
        lines: {
          orderBy: { lineNo: "asc" },
          include: {
            order: {
              select: { id: true, number: true, status: true, parcel: { select: { id: true, number: true, status: true } }, parcelTask: { select: { id: true, number: true } } },
            },
          },
        },
        statusHistory: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true } } } },
        ledgerEntries: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      },
    }),
    auth(),
    getPurchaseSettings(),
  ]);
  if (!purchase) notFound();
  const [balance, paidNet, options, country, delivery] = await Promise.all([
    clientBalance(purchase.customerId),
    purchasePaidNet(prisma, purchase.id),
    purchaseFormOptions(purchase.customerId),
    purchase.countryCode ? prisma.country.findUnique({ where: { code: purchase.countryCode }, select: { nameRu: true } }) : null,
    purchase.deliveryType ? prisma.deliveryMethod.findUnique({ where: { code: purchase.deliveryType }, select: { nameRu: true } }) : null,
  ]);
  const total = n(purchase.totalCny);
  const due = total != null && purchase.status !== "NEW" ? round2(total - paidNet) : null;
  const paidToSeller = purchase.lines.reduce((sum, l) => sum + (n(l.paidToSellerCny) ?? 0), 0);
  const returned = round2(-purchase.ledgerEntries.filter((e) => e.reason === "PURCHASE_RETURN").reduce((s, e) => s + Number(e.amount), 0));
  const turnkey = purchase.mode === "TURNKEY";
  const services = PURCHASE_SERVICE_FIELDS.filter((s) => purchase[s.field]).map((s) => options.services.find((o) => o.field === s.field)?.name ?? s.fallback);
  const parcels = [...new Map(purchase.lines.flatMap((l) => (l.order?.parcel ? [[l.order.parcel.id, l.order.parcel] as const] : []))).values()];
  const steps = [
    { label: "Заявка", at: purchase.createdAt },
    { label: "Цена назначена", at: purchase.pricedAt },
    { label: "Оплачена", at: purchase.paidAt },
    { label: "Выкуплена", at: purchase.purchasedAt },
    { label: "На складе", at: purchase.arrivedAt },
    { label: "Отправлена", at: purchase.shippedAt },
  ];
  const closed = ["REJECTED", "CANCELED", "RETURNED"].includes(purchase.status);
  const now = new Date();

  return (
    <>
      <Form
        formKey="purchase"
        guid={purchase.id}
        title={purchase.number}
        titleExtra={
          <>
            <span className={`st st--${PURCHASE_STATUS_COLOR[purchase.status]}`}>{purchaseStatusLabel(purchase.status)}</span>
            <span className="st st--new">{PURCHASE_MODE_LABELS[purchase.mode]}</span>
            {due != null && due > 0 && purchase.status !== "PRICED" && <span className="st st--processing">ждём доплату {yuan(due)}</span>}
            {purchase.deletedAt && <span className="st st--canceled">помечена на удаление</span>}
          </>
        }
        footer={<>Покупка · создана {formatDateTime(purchase.createdAt)} · связанные документы — Ctrl+Shift+S</>}
      >
        <div className="bo-grid">
          <div className="bo-col">
            <section className="card card--pad">
              <h2 className="card-title">Покупка</h2>
              <dl className="bo-dl">
                <dt>Клиент</dt>
                <dd>
                  <Link href={`/clients/${purchase.customer.id}`}>{purchase.customer.code ? `${purchase.customer.code} — ` : ""}{purchase.customer.name}</Link>
                  {!purchase.customer.telegramChatId && <span className="muted"> · Telegram не привязан — сообщения не придут</span>}
                </dd>
                <dt>Баланс клиента</dt><dd>{yuan(balance)}</dd>
                <dt>Режим</dt><dd>{PURCHASE_MODE_LABELS[purchase.mode]}</dd>
                {turnkey && (
                  <>
                    <dt>Страна</dt><dd>{purchase.countryCode ? `${purchase.countryCode} — ${country?.nameRu ?? ""}` : "—"}</dd>
                    <dt>Получатель</dt>
                    <dd>{purchase.recipient ? <Link href={`/recipients/${purchase.recipient.id}`}>{purchase.recipient.name}</Link> : "не выбран"}{purchase.recipient?.city ? `, ${purchase.recipient.city}` : ""}</dd>
                    <dt>Вид доставки</dt><dd>{delivery?.nameRu ?? "—"}</dd>
                    <dt>Примерный вес</dt><dd>{purchase.estimatedWeightKg != null ? `${Number(purchase.estimatedWeightKg)} кг` : "—"}</dd>
                  </>
                )}
                <dt>Услуги</dt><dd>{services.join(", ") || "—"}</dd>
                <dt>Комментарий клиента</dt><dd className="pre">{dash(purchase.customerComment)}</dd>
                <dt>Автор</dt><dd>{purchase.createdBy?.name ?? "клиент из кабинета"}</dd>
                {purchase.rejectReason && (<><dt>Причина отказа</dt><dd>{purchase.rejectReason}</dd></>)}
              </dl>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ padding: "12px 14px 0" }}>Товары <span className="muted">· {purchase.lines.length}</span></h2>
              <div className="table-wrap">
                <table className="table pl-table">
                  <thead>
                    <tr><th>№</th><th>Товар</th><th className="num">Кол-во</th><th className="num">Цена</th><th className="num">По Китаю</th><th>Статус</th><th>Трек / заказ</th><th /></tr>
                  </thead>
                  <tbody>
                    {purchase.lines.map((line) => {
                      const files = readAttachments(line.attachments);
                      return (
                        <tr key={line.id}>
                          <td className="muted">{line.lineNo}</td>
                          <td>
                            <div className="pl-name">{line.productName}{line.variant ? <span className="muted"> · {line.variant}</span> : null}</div>
                            <div className="pl-sub">
                              {PURCHASE_LINE_KIND_LABELS[line.kind]} · {marketplaceLabel(line.marketplace)}{line.seller ? ` · ${line.seller}` : ""}
                              {line.url ? <> · <a href={line.url} target="_blank" rel="noopener noreferrer nofollow">{shortHost(line.url)}</a></> : null}
                              {line.sellerContact ? ` · продавец: ${line.sellerContact}` : ""}
                            </div>
                            {files.length > 0 && (
                              <div className="bo-files" style={{ marginTop: 6 }}>
                                {files.map((file) => (
                                  <a key={file.url} href={file.url} target="_blank" rel="noopener noreferrer" title={file.name} style={{ width: 56, height: 56 }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- закрытые файлы: отдаёт /api/purchases/files с проверкой доступа */}
                                    <img src={file.url} alt={file.name} />
                                  </a>
                                ))}
                              </div>
                            )}
                            {line.rejectReason && <div className="pl-sub">Отказ: {line.rejectReason}</div>}
                            {line.returnKind && <div className="pl-sub">{PURCHASE_RETURN_KIND_LABELS[line.returnKind]} · на баланс {yuan(line.refundCny)}</div>}
                            {(line.sellerOrderNo || line.paidToSellerCny != null) && (
                              <div className="pl-sub">{line.sellerOrderNo ? `заказ у продавца ${line.sellerOrderNo}` : ""}{line.paidToSellerCny != null ? ` · заплачено ${yuan(line.paidToSellerCny)}` : ""}</div>
                            )}
                          </td>
                          <td className="num">{line.quantity}</td>
                          <td className="num">{line.unitPriceCny != null ? yuan(line.unitPriceCny) : "—"}</td>
                          <td className="num">{line.chinaDeliveryCny != null ? yuan(line.chinaDeliveryCny) : "—"}</td>
                          <td><span className={`st st--${PURCHASE_LINE_STATUS_COLOR[line.status]}`}>{PURCHASE_LINE_STATUS_LABELS[line.status]}</span></td>
                          <td>
                            <div className="mono">{line.sellerTrack ?? "—"}</div>
                            {line.order && (
                              <div className="pl-sub">
                                <Link href={`/orders/${line.order.id}/edit`}>{line.order.number}</Link>{" "}
                                <span className={`st st--${ORDER_STATUS_COLOR[line.order.status]}`}>{orderStatusLabel(line.order.status)}</span>
                              </div>
                            )}
                          </td>
                          <td>
                            {!purchase.deletedAt && !closed && (
                              <PurchaseLineActions
                                purchaseId={purchase.id}
                                line={{
                                  id: line.id,
                                  lineNo: line.lineNo,
                                  status: line.status,
                                  sellerTrack: line.sellerTrack ?? "",
                                  sellerOrderNo: line.sellerOrderNo ?? "",
                                  paidToSellerCny: line.paidToSellerCny != null ? String(Number(line.paidToSellerCny)) : "",
                                  photoUrl: line.photoUrl ?? "",
                                  goodsCny: round2((n(line.unitPriceCny) ?? 0) * line.quantity),
                                  costCny: round2(
                                    (n(line.unitPriceCny) ?? 0) * line.quantity +
                                      (n(line.chinaDeliveryCny) ?? 0) +
                                      ((n(purchase.goodsCny) ?? 0) > 0 ? ((n(purchase.commissionCny) ?? 0) * (n(line.unitPriceCny) ?? 0) * line.quantity) / (n(purchase.goodsCny) ?? 1) : 0)
                                  ),
                                  hasOrder: Boolean(line.orderId),
                                  orderLocked: Boolean(line.order && !["NEW", "IN_RECEIVING_QUEUE"].includes(line.order.status)),
                                }}
                                paid={["PAID", "PURCHASED", "AT_WAREHOUSE", "SHIPPED"].includes(purchase.status) && (due ?? 0) <= 0}
                                rejectReasons={settings.rejectReasons}
                                isAdmin={session?.user.role === "ADMIN"}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card card--pad">
              <h2 className="card-title">Цена, ¥</h2>
              {total == null ? (
                <p className="muted">Цена ещё не назначена.</p>
              ) : (
                <table className="bo-money" style={{ width: "100%" }}>
                  <tbody>
                    <tr><td>Товар</td><td>{yuan(purchase.goodsCny)}</td></tr>
                    <tr><td>Доставка по Китаю до склада</td><td>{yuan(purchase.chinaDeliveryCny)}</td></tr>
                    <tr>
                      <td>Комиссия{purchase.commissionManual ? " (поправлена вручную)" : purchase.commissionPercent != null ? ` (${Number(purchase.commissionPercent)}%${purchase.commissionMinCny ? `, не меньше ${yuan(purchase.commissionMinCny)}` : ""})` : ""}</td>
                      <td>{yuan(purchase.commissionCny)}</td>
                    </tr>
                    <tr className="total"><td>К оплате за покупку</td><td>{yuan(total)}</td></tr>
                    {turnkey && (
                      <>
                        <tr className="pl-est"><td>Международная доставка — ориентировочно</td><td>{purchase.shippingEstimateCny != null ? yuan(purchase.shippingEstimateCny) : "рассчитает менеджер"}</td></tr>
                        {purchase.servicesEstimateCny != null && <tr className="pl-est"><td>Услуги — ориентировочно</td><td>{yuan(purchase.servicesEstimateCny)}</td></tr>}
                        {purchase.dutyEstimateCny != null && <tr className="pl-est"><td>Возможная пошлина</td><td>{yuan(purchase.dutyEstimateCny)}</td></tr>}
                      </>
                    )}
                  </tbody>
                </table>
              )}
              {turnkey && total != null && <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>Доставка за границу и услуги — после взвешивания посылки, в её квитанции.</p>}
            </section>

            <section className="card card--pad">
              <h2 className="card-title">Деньги клиента по покупке</h2>
              <table className="bo-money" style={{ width: "100%" }}>
                <tbody>
                  <tr><td>Оплачено (списания минус возвраты)</td><td>{yuan(paidNet)}</td></tr>
                  {due != null && due > 0 && <tr><td><b>{purchase.status === "PRICED" ? "Ждём оплату" : "Ждём доплату"}</b></td><td><b>{yuan(due)}</b></td></tr>}
                  {returned > 0 && <tr><td>Возвращено за возвращённые товары</td><td>{yuan(returned)}</td></tr>}
                  {paidToSeller > 0 && <tr><td className="muted">Заплачено продавцам</td><td className="muted">{yuan(paidToSeller)}</td></tr>}
                  {paidToSeller > 0 && total != null && <tr><td className="muted">Наша разница</td><td className="muted">{yuan(round2(total - paidToSeller))}</td></tr>}
                </tbody>
              </table>
              {purchase.ledgerEntries.length > 0 && (
                <ul className="bo-history" style={{ marginTop: 10 }}>
                  {purchase.ledgerEntries.map((entry) => (
                    <li key={entry.id}>
                      <span className="muted">{formatDateTime(entry.createdAt)}</span>
                      <span>
                        <span className="mono">{entry.number}</span> · {LEDGER_REASON_LABELS[entry.reason]}:{" "}
                        <b>{Number(entry.amount) > 0 ? `−${yuan(entry.amount)}` : `+${yuan(-Number(entry.amount))}`}</b> на балансе
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card card--pad">
              <h2 className="card-title">Время прохождения</h2>
              <ul className="pl-steps">
                {steps.map((step, index) => {
                  const prev = steps.slice(0, index).reverse().find((s) => s.at)?.at ?? null;
                  const isNext = !step.at && steps.slice(0, index).every((s) => s.at) && !closed;
                  return (
                    <li key={step.label}>
                      <span>{step.label}</span>
                      <span className={step.at ? "" : "pl-wait"}>{step.at ? formatDateTime(step.at) : isNext ? "ждём" : "—"}</span>
                      <span className="pl-dur">
                        {step.at && prev && index > 0 ? `+${duration(prev, step.at)}` : isNext && prev ? `идёт ${duration(prev, now)}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {purchase.createdAt && (purchase.shippedAt ?? purchase.arrivedAt) && (
                <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>Всего: {duration(purchase.createdAt, (purchase.shippedAt ?? purchase.arrivedAt)!)}</p>
              )}
            </section>

            {parcels.length > 0 && (
              <section className="card card--pad">
                <h2 className="card-title">Посылка</h2>
                <ul className="bo-history">
                  {parcels.map((p) => (
                    <li key={p.id}>
                      <Link href={`/parcels/${p.id}`} className="mono">{p.number}</Link>
                      <span><span className={`st st--${PARCEL_STATUS_COLOR[p.status]}`}>{parcelStatusLabel(p.status)}</span></span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="card card--pad">
              <h2 className="card-title">История</h2>
              <ul className="bo-history">
                {purchase.statusHistory.map((h) => (
                  <li key={h.id}>
                    <span className="muted">{formatDateTime(h.createdAt)}</span>
                    <span>
                      <b>{purchaseStatusLabel(h.status)}</b>
                      {h.note ? ` — ${h.note}` : ""}
                      <span className="muted"> · {h.changedBy?.name ?? (h.byClient ? "клиент" : "программа")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="bo-col">
            <PurchaseActions
              id={purchase.id}
              status={purchase.status}
              deleted={Boolean(purchase.deletedAt)}
              isAdmin={session?.user.role === "ADMIN"}
              hasOrders={purchase.lines.some((l) => l.orderId)}
              paidNet={paidNet}
              header={{
                mode: purchase.mode,
                countryCode: purchase.countryCode ?? "",
                recipientId: purchase.recipientId ?? "",
                deliveryType: purchase.deliveryType ?? "",
                estimatedWeightKg: purchase.estimatedWeightKg != null ? String(Number(purchase.estimatedWeightKg)) : "",
                services: Object.fromEntries(PURCHASE_SERVICE_FIELDS.map((s) => [s.field, purchase[s.field]])),
                commissionManual: purchase.commissionManual,
                commissionCny: n(purchase.commissionCny),
              }}
              lines={purchase.lines.map((l) => ({
                id: l.id,
                lineNo: l.lineNo,
                status: l.status,
                productName: l.productName,
                variant: l.variant ?? "",
                quantity: l.quantity,
                unitPriceCny: n(l.unitPriceCny),
                chinaDeliveryCny: n(l.chinaDeliveryCny),
                marketplace: l.marketplace ?? "OTHER",
                seller: l.seller ?? "",
              }))}
              rule={purchase.pricedAt ? { percent: n(purchase.commissionPercent), minCny: n(purchase.commissionMinCny) } : { percent: settings.commissionPercent, minCny: settings.commissionMinCny }}
              rejectReasons={settings.rejectReasons}
              options={options}
              internalComment={purchase.internalComment ?? ""}
            />
          </div>
        </div>
      </Form>
      <style>{PURCHASE_ADMIN_CSS + PURCHASE_CARD_CSS}</style>
    </>
  );
}
