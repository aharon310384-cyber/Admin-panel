import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { balanceMoves, clientBalance } from "@/lib/balance";
import { parseMoney, yuan } from "@/lib/buyout-money";
import { getBuyoutSettings } from "@/lib/buyouts";
import { TOP_UP_STATUS_LABELS } from "@/lib/statuses";
import TopUpForm from "../_components/top-up-form";
import { BUYOUT_CABINET_CSS, BUYOUT_PILL } from "../_components/styles";

export const metadata: Metadata = { title: "Баланс" };

// Баланс клиента в кабинете: сколько денег, как пополнить (реквизиты из настроек), заявки на пополнение и движения.

export default async function CabinetBalancePage({ searchParams }: { searchParams: Promise<{ amount?: string }> }) {
  const { client } = await getClientCabinetContext();
  const { amount } = await searchParams;
  const suggested = parseMoney(amount ?? null);
  const [balance, moves, requests, settings] = await Promise.all([
    clientBalance(client.id),
    balanceMoves(client.id, 30),
    prisma.topUpRequest.findMany({ where: { customerId: client.id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10 }),
    getBuyoutSettings(),
  ]);

  return (
    <div className="bk">
      <header className="bk-head">
        <Link href="/cabinet/buyouts" className="bk-btn bk-btn--ghost bk-btn--small" aria-label="Назад к выкупам">
          <ChevronLeft size={16} />
        </Link>
        <h1 className="bk-title">Баланс</h1>
      </header>

      <div className="bk-balance">
        <div>
          <div className="bk-balance-label">На балансе</div>
          <div className="bk-balance-value">{yuan(balance)}</div>
        </div>
      </div>

      <h2 className="bk-h2">Пополнить</h2>
      <div className="bk-card">
        {settings.topUpInstructions ? <p className="bk-info">{settings.topUpInstructions}</p> : <p className="bk-hint">Реквизиты для оплаты пришлёт менеджер.</p>}
        <TopUpForm customerId={client.id} methods={settings.topUpMethods} amount={suggested && suggested > 0 ? String(suggested) : ""} />
        <p className="bk-hint">Деньги появятся на балансе после проверки оплаты — придёт сообщение в Telegram.</p>
      </div>

      {requests.length > 0 && (
        <>
          <h2 className="bk-h2">Заявки на пополнение</h2>
          <div className="bk-card">
            <ul className="bk-moves">
              {requests.map((r) => (
                <li key={r.id}>
                  <span>
                    <b>{yuan(r.amount)}</b> <span className="bk-muted">· {r.number} · {formatDateTime(r.createdAt)}</span>
                    {r.cancelReason ? <div className="bk-hint">{r.cancelReason}</div> : null}
                  </span>
                  <span className="bk-pill" style={{ ["--pill" as string]: r.status === "CANCELED" ? BUYOUT_PILL.CANCELED_TOPUP : r.status === "PAID" ? BUYOUT_PILL.AT_WAREHOUSE : BUYOUT_PILL.PENDING }}>
                    {TOP_UP_STATUS_LABELS[r.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <h2 className="bk-h2">Движения</h2>
      <div className="bk-card">
        {moves.length === 0 ? (
          <p className="bk-hint">Пока пусто.</p>
        ) : (
          <ul className="bk-moves">
            {moves.map((m) => (
              <li key={m.id}>
                <span>
                  {m.label}
                  <div className="bk-hint">{formatDateTime(m.date)}{m.note ? ` · ${m.note}` : ""}</div>
                </span>
                <span className={m.amount >= 0 ? "bk-plus" : "bk-minus"}>{m.amount >= 0 ? "+" : "−"}{yuan(Math.abs(m.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <style>{BUYOUT_CABINET_CSS}</style>
    </div>
  );
}
