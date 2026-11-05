import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, Wallet } from "lucide-react";
import type { PurchaseStatus } from "@prisma/client";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { clientBalance } from "@/lib/balance";
import { round2, yuan } from "@/lib/purchase-money";
import { shortHost } from "@/lib/purchase-lines";
import { syncPurchases } from "@/lib/purchases";
import { PURCHASE_LINE_STATUS_LABELS, PURCHASE_MODE_LABELS, PURCHASE_STATUS_HINTS, PURCHASE_STATUS_LABELS } from "@/lib/statuses";
import PurchaseCardActions from "./_components/purchase-card-actions";
import { PURCHASE_CABINET_CSS, PURCHASE_CART_CSS, PURCHASE_PILL } from "./_components/styles";

export const metadata: Metadata = { title: "Мои покупки" };

// «Мои покупки» (docs/product/задание-выкуп.md, раздел 9; стратегия FOX2DOOR, 7.2): у каждой покупки —
// что произошло / что происходит / что нужно от меня / сколько заплатить. Клиент видит только свои покупки.

const PAYABLE: PurchaseStatus[] = ["PRICED", "PAID", "PURCHASED", "AT_WAREHOUSE"];

export default async function CabinetPurchasesPage({ searchParams }: { searchParams: Promise<{ created?: string; done?: string; n?: string }> }) {
  const { client } = await getClientCabinetContext();
  const { created, done, n } = await searchParams;
  await syncPurchases({ customerId: client.id });
  const [purchases, balance] = await Promise.all([
    prisma.purchase.findMany({
      where: { customerId: client.id, deletedAt: null },
      include: {
        lines: { orderBy: { lineNo: "asc" }, include: { order: { select: { number: true } } } },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    clientBalance(client.id),
  ]);
  const paidRows = purchases.length
    ? await prisma.clientLedger.groupBy({
        by: ["purchaseId"],
        where: { purchaseId: { in: purchases.map((p) => p.id) }, deletedAt: null, reason: { in: ["PURCHASE_PAYMENT", "PURCHASE_REFUND"] } },
        _sum: { amount: true },
      })
    : [];
  const paidOf = new Map(paidRows.map((r) => [r.purchaseId, Number(r._sum.amount ?? 0)]));
  const countries = await prisma.country.findMany({
    where: { code: { in: [...new Set(purchases.map((p) => p.countryCode).filter((c): c is string => Boolean(c)))] } },
    select: { code: true, nameRu: true },
  });
  const countryName = new Map(countries.map((c) => [c.code, c.nameRu]));

  return (
    <div className="bk">
      <header className="bk-head">
        <h1 className="bk-title">Мои покупки</h1>
        <span className="bk-count">{purchases.length}</span>
        <span className="bk-spacer" />
        <Link href="/cabinet/purchases/new" className="bk-btn bk-btn--primary bk-btn--small">
          <ShoppingBag size={16} />
          Хочу купить
        </Link>
      </header>

      <div className="bk-balance">
        <div>
          <div className="bk-balance-label">Баланс</div>
          <div className="bk-balance-value">{yuan(balance)}</div>
        </div>
        <Link href="/cabinet/purchases/balance" className="bk-btn bk-btn--small">
          <Wallet size={16} />
          Пополнить
        </Link>
      </div>

      {done === "paid" && n && <p className="bk-ok">Покупка {n} оплачена с баланса. Покупаем у продавцов — сообщим, когда выкупим.</p>}
      {done === "canceled" && n && <p className="bk-ok">Покупка {n} отменена.</p>}
      {created && <p className="bk-ok">Заявка {created} отправлена. Менеджер проверит товары и назовёт цену — придёт сообщение в Telegram.</p>}

      {purchases.length === 0 ? (
        <div className="bk-empty">
          <ShoppingBag size={30} className="bk-muted" />
          <p><b>Покупок пока нет</b></p>
          <p className="bk-hint">Нажмите «Хочу купить»: Taobao, Tmall, 1688, Weidian и другие сайты — или продавец в WeChat</p>
        </div>
      ) : (
        <ul className="bk-list">
          {purchases.map((p) => {
            const total = p.totalCny != null ? Number(p.totalCny) : null;
            const paid = round2(paidOf.get(p.id) ?? 0);
            const due = total != null && PAYABLE.includes(p.status) ? Math.max(0, round2(total - paid)) : 0;
            const active = p.lines.filter((l) => l.status !== "REJECTED");
            const bought = active.filter((l) => l.status !== "WAITING").length;
            const arrived = active.filter((l) => l.status === "AT_WAREHOUSE").length;
            const last = p.statusHistory[0];
            const turnkey = p.mode === "TURNKEY";
            const need =
              p.status === "NEW"
                ? "Ничего — ждите цену, придёт сообщение."
                : due > 0
                  ? p.status === "PRICED"
                    ? `Оплатить ${yuan(due)} с баланса.`
                    : `Доплатить ${yuan(due)}: цена у продавца изменилась.`
                  : p.status === "AT_WAREHOUSE" && !turnkey
                    ? "Оформите посылку в «Посылках», когда будете готовы."
                    : p.status === "AT_WAREHOUSE"
                      ? "Ничего — соберём посылку и пришлём вес и цену доставки."
                      : ["REJECTED", "CANCELED", "RETURNED", "SHIPPED"].includes(p.status)
                        ? null
                        : "Ничего — мы сообщим о каждом шаге.";
            return (
              <li key={p.id} className="bk-card">
                <div className="bk-card-top">
                  <div style={{ minWidth: 0 }}>
                    <span className="bk-num">
                      {p.number} · {formatDateTime(p.createdAt)} · {PURCHASE_MODE_LABELS[p.mode].toLowerCase()}
                      {p.countryCode ? ` · ${countryName.get(p.countryCode) ?? p.countryCode}` : ""}
                    </span>
                    <p className="bk-name">{active.map((l) => l.productName).join(", ") || p.lines.map((l) => l.productName).join(", ")}</p>
                  </div>
                  <span className="bk-pill" style={{ ["--pill" as string]: PURCHASE_PILL[p.status] }}>{PURCHASE_STATUS_LABELS[p.status]}</span>
                </div>

                <ul className="pc-lines">
                  {p.lines.map((l) => (
                    <li key={l.id}>
                      <span>
                        {l.productName}
                        <span className="bk-muted">{[l.variant, `${l.quantity} шт.`].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                        {l.url && <> · <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="bk-muted">{shortHost(l.url)}</a></>}
                      </span>
                      <span className="pc-st">
                        {PURCHASE_LINE_STATUS_LABELS[l.status]}
                        {l.sellerTrack ? ` · ${l.sellerTrack}` : ""}
                        {l.rejectReason ? ` · ${l.rejectReason}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="pc-facts">
                  <dt>Что произошло</dt>
                  <dd>{last ? `${last.note ?? PURCHASE_STATUS_LABELS[last.status]} · ${formatDateTime(last.createdAt)}` : "—"}</dd>
                  <dt>Что происходит</dt>
                  <dd>
                    {PURCHASE_STATUS_HINTS[p.status]}
                    {["PAID", "PURCHASED"].includes(p.status) && active.length > 1 ? ` (выкуплено ${bought} из ${active.length}, на складе ${arrived})` : ""}
                    {p.rejectReason && p.status === "REJECTED" ? `: ${p.rejectReason}` : ""}
                  </dd>
                </dl>

                {total != null && (
                  <div className="bk-money">
                    <span>Товар</span><span>{yuan(p.goodsCny)}</span>
                    <span>Доставка по Китаю</span><span>{yuan(p.chinaDeliveryCny)}</span>
                    <span>Комиссия</span><span>{yuan(p.commissionCny)}</span>
                    <span className="bk-total">За покупку</span><span className="bk-total">{yuan(total)}</span>
                    {paid > 0 && (<><span className="bk-muted">Оплачено</span><span className="bk-muted">{yuan(paid)}</span></>)}
                    {turnkey && (
                      <>
                        <span className="bk-muted">Доставка за границу</span>
                        <span className="bk-muted">{p.shippingEstimateCny != null ? `≈ ${yuan(p.shippingEstimateCny)}` : "после взвешивания"}</span>
                      </>
                    )}
                  </div>
                )}

                {need && (
                  <div className={`pc-need ${due > 0 ? "" : "pc-need--calm"}`}>
                    <b>Что нужно от вас</b>
                    <span>{need}</span>
                    {due > 0 && <span className="bk-muted">Сколько заплатить сейчас: {yuan(due)}{turnkey ? " · доставку за границу — после взвешивания посылки" : ""}</span>}
                  </div>
                )}

                {(p.status === "NEW" || due > 0) && (
                  <PurchaseCardActions id={p.id} number={p.number} canCancel={p.status === "NEW" || p.status === "PRICED"} due={due} balance={balance} />
                )}
                {p.lines.some((l) => l.order) && (
                  <p className="bk-hint" style={{ margin: 0 }}>Заказы на складе: {p.lines.filter((l) => l.order).map((l) => l.order!.number).join(", ")} — в разделе «Заказы».</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <style>{PURCHASE_CABINET_CSS + PURCHASE_CART_CSS}</style>
    </div>
  );
}
