import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ShoppingCart, Wallet } from "lucide-react";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { clientBalance } from "@/lib/balance";
import { yuan } from "@/lib/buyout-money";
import { syncBuyoutsAtWarehouse } from "@/lib/buyouts";
import { BUYOUT_KIND_LABELS, BUYOUT_STATUS_HINTS, BUYOUT_STATUS_LABELS } from "@/lib/statuses";
import BuyoutCardActions from "./_components/buyout-card-actions";
import { BUYOUT_CABINET_CSS, BUYOUT_PILL } from "./_components/styles";

export const metadata: Metadata = { title: "Выкуп" };

// «Выкуп» в кабинете клиента (docs/product/задание-выкуп.md, раздел 6): свои заявки со статусами,
// «Оплатить с баланса», когда цена назначена. Клиент видит только свои выкупы.

const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
};

export default async function CabinetBuyoutsPage({ searchParams }: { searchParams: Promise<{ created?: string; done?: string; n?: string }> }) {
  const { client } = await getClientCabinetContext();
  const { created, done, n } = await searchParams;
  await syncBuyoutsAtWarehouse({ customerId: client.id });
  const [buyouts, balance] = await Promise.all([
    prisma.buyout.findMany({
      where: { customerId: client.id, deletedAt: null },
      include: { order: { select: { number: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    clientBalance(client.id),
  ]);

  return (
    <div className="bk">
      <header className="bk-head">
        <h1 className="bk-title">Выкуп</h1>
        <span className="bk-count">{buyouts.length}</span>
        <span className="bk-spacer" />
        <Link href="/cabinet/buyouts/new" className="bk-btn bk-btn--primary bk-btn--small">
          <Plus size={16} strokeWidth={2.5} />
          Новая заявка
        </Link>
      </header>
      <p className="bk-sub">Купим товар в Китае за вас: пришлите ссылку или контакт продавца — назовём цену, оплатите с баланса.</p>

      <div className="bk-balance">
        <div>
          <div className="bk-balance-label">Баланс</div>
          <div className="bk-balance-value">{yuan(balance)}</div>
        </div>
        <Link href="/cabinet/buyouts/balance" className="bk-btn bk-btn--small">
          <Wallet size={16} />
          Пополнить
        </Link>
      </div>

      {done === "paid" && n && <p className="bk-ok">Выкуп {n} оплачен с баланса. Покупаем у продавца — сообщим, когда выкупим.</p>}
      {done === "canceled" && n && <p className="bk-ok">Заявка {n} отменена.</p>}
      {created && <p className="bk-ok">Заявка {created} отправлена. Менеджер проверит товар и назовёт цену — придёт сообщение в Telegram.</p>}

      {buyouts.length === 0 ? (
        <div className="bk-empty">
          <ShoppingCart size={30} className="bk-muted" />
          <p><b>Заявок пока нет</b></p>
          <p className="bk-hint">Taobao, Tmall, 1688, Weidian и другие сайты — или продавец в WeChat</p>
        </div>
      ) : (
        <ul className="bk-list">
          {buyouts.map((b) => {
            const total = b.totalCny != null ? Number(b.totalCny) : null;
            return (
              <li key={b.id} className="bk-card">
                <div className="bk-card-top">
                  <div style={{ minWidth: 0 }}>
                    <span className="bk-num">{b.number} · {formatDateTime(b.createdAt)} · {BUYOUT_KIND_LABELS[b.kind].toLowerCase()}</span>
                    <p className="bk-name">{b.productName}</p>
                  </div>
                  <span className="bk-pill" style={{ ["--pill" as string]: BUYOUT_PILL[b.status] }}>{BUYOUT_STATUS_LABELS[b.status]}</span>
                </div>
                <div className="bk-line">
                  {[b.variant, `${b.quantity} шт.`].filter(Boolean).join(" · ")}
                  {b.url && <> · <a href={b.url} target="_blank" rel="noopener noreferrer nofollow">{host(b.url)}</a></>}
                  {b.sellerContact && <> · продавец: {b.sellerContact}</>}
                </div>
                {total != null && (
                  <div className="bk-money">
                    <span>Товар</span><span>{yuan(b.goodsCny)}</span>
                    <span>Доставка по Китаю</span><span>{yuan(b.chinaDeliveryCny)}</span>
                    <span>Комиссия</span><span>{yuan(b.commissionCny)}</span>
                    <span className="bk-total">Итого</span><span className="bk-total">{yuan(total)}</span>
                  </div>
                )}
                <div className="bk-hint">
                  {[
                    BUYOUT_STATUS_HINTS[b.status],
                    b.rejectReason ? `Причина: ${b.rejectReason}` : null,
                    b.refundCny != null && Number(b.refundCny) > 0 ? `Возвращено на баланс: ${yuan(b.refundCny)}` : null,
                    b.sellerTrack ? `Трек продавца: ${b.sellerTrack}` : null,
                    b.order?.number ? `Заказ ${b.order.number}` : null,
                  ]
                    .filter(Boolean)
                    .join(". ")}
                  .
                </div>
                {(b.status === "NEW" || b.status === "PRICED") && (
                  <BuyoutCardActions id={b.id} number={b.number} status={b.status} total={total} balance={balance} />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <style>{BUYOUT_CABINET_CSS}</style>
    </div>
  );
}
