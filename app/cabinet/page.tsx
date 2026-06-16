import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Package, Plus, Truck, Wallet } from "lucide-react";
import type { ParcelStatus, Prisma } from "@prisma/client";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { prisma } from "@/lib/prisma";
import StatusPill, { statusLabel } from "@/components/cabinet/status-pill";
import { formatUsd, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Обзор" };

const ACTIVE_STATUSES: ParcelStatus[] = ["NEW", "PROCESSING", "SHIPPED", "PAID"];
const TIMELINE: ParcelStatus[] = ["NEW", "PROCESSING", "SHIPPED", "COMPLETED"];

function greetingName(client: {
  firstName: string | null;
  name: string;
  code: string;
}): string {
  const first = client.firstName?.trim();
  if (first) return first;
  const name = client.name.trim();
  if (name && name.toLowerCase() !== client.code.trim().toLowerCase()) return name;
  return "клиент";
}

export default async function ClientCabinetOverviewPage() {
  const { client } = await getClientCabinetContext();
  const codeVariants = Array.from(
    new Set([client.code, client.code.toUpperCase(), client.code.toLowerCase()])
  );

  const base: Prisma.ParcelWhereInput = {
    deletedAt: null,
    routePrefix: { in: codeVariants },
  };

  const [parcels, totalCount, activeCount, inTransitCount, toPayAgg] =
    await Promise.all([
      prisma.parcel.findMany({
        where: base,
        select: {
          id: true,
          number: true,
          status: true,
          totalUsd: true,
          isPaid: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      prisma.parcel.count({ where: base }),
      prisma.parcel.count({ where: { ...base, status: { in: ACTIVE_STATUSES } } }),
      prisma.parcel.count({ where: { ...base, status: "SHIPPED" } }),
      prisma.parcel.aggregate({
        _sum: { totalUsd: true },
        where: { ...base, isPaid: false, status: { not: "CANCELED" } },
      }),
    ]);

  const name = greetingName(client);
  const toPay = toPayAgg._sum.totalUsd ?? 0;
  const latest = parcels[0] ?? null;
  const latestStep = latest ? TIMELINE.indexOf(latest.status) : -1;

  return (
    <div className="ov">
      <header className="ov-greet">
        <p className="ov-hello">Здравствуйте,</p>
        <h1 className="ov-name">{name}</h1>
        <span className="ov-code">{client.code}</span>
      </header>

      <div className="ov-bento">
        <Link href="/cabinet/parcels" className="ov-card ov-hero">
          <div className="ov-hero-top">
            <span className="ov-hero-icon"><Package size={18} /></span>
            <span className="ov-card-label">Активные посылки</span>
          </div>
          <strong className="ov-hero-num">{activeCount}</strong>
          <span className="ov-hero-sub">из {totalCount} всего</span>
        </Link>

        <div className="ov-card ov-card--amber">
          <div className="ov-card-top">
            <span className="ov-card-icon ov-card-icon--amber"><Wallet size={16} /></span>
            <span className="ov-card-label">К оплате</span>
          </div>
          <strong className="ov-money">{formatUsd(toPay)}</strong>
        </div>

        <div className="ov-card ov-card--mint">
          <div className="ov-card-top">
            <span className="ov-card-icon ov-card-icon--mint"><Truck size={16} /></span>
            <span className="ov-card-label">В пути</span>
          </div>
          <strong className="ov-num">{inTransitCount}</strong>
        </div>
      </div>

      {latest ? (
        <Link href={`/cabinet/parcels/${latest.id}`} className="ov-card ov-latest">
          <div className="ov-latest-head">
            <div>
              <span className="ov-card-label">Последняя посылка</span>
              <span className="ov-latest-num">{latest.number}</span>
            </div>
            <StatusPill status={latest.status} />
          </div>

          <div className="ov-timeline" aria-hidden="true">
            {TIMELINE.map((step, i) => {
              const reached = latestStep >= 0 && i <= latestStep;
              const isLast = i === TIMELINE.length - 1;
              return (
                <div key={step} className="ov-step">
                  <span className={`ov-dot ${reached ? "ov-dot--on" : ""}`} />
                  {!isLast && (
                    <span className={`ov-line ${reached && i < latestStep ? "ov-line--on" : ""}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="ov-timeline-labels">
            {TIMELINE.map((step) => (
              <span key={step}>{statusLabel(step)}</span>
            ))}
          </div>
        </Link>
      ) : (
        <div className="ov-card ov-empty">
          <Package size={28} className="ov-empty-icon" />
          <p className="ov-empty-title">Пока нет посылок</p>
          <p className="ov-empty-sub">Оформите первый заказ — он появится здесь</p>
        </div>
      )}

      <section className="ov-recent">
        <div className="ov-recent-head">
          <h2 className="ov-recent-title">Недавние</h2>
          <Link href="/cabinet/parcels" className="ov-recent-all">
            Все посылки <ArrowRight size={14} />
          </Link>
        </div>

        {parcels.length === 0 ? (
          <p className="ov-recent-empty">Список пуст</p>
        ) : (
          <ul className="ov-list">
            {parcels.map((p) => (
              <li key={p.id}>
                <Link href={`/cabinet/parcels/${p.id}`} className="ov-row">
                  <span className="ov-row-num">{p.number}</span>
                  <span className="ov-row-mid">
                    <StatusPill status={p.status} />
                    <span className="ov-row-date">{formatDate(p.createdAt)}</span>
                  </span>
                  <span className="ov-row-sum">{formatUsd(p.totalUsd)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <span className="ov-cta ov-cta--off" aria-disabled="true" title="Скоро">
        <Plus size={18} strokeWidth={2.5} />
        Оформить заказ
      </span>

      <style>{`
        .ov { display: flex; flex-direction: column; gap: 16px; padding-bottom: 8px; }

        .ov-greet { padding: 8px 4px 2px; }
        .ov-hello { margin: 0; color: var(--cab-muted); font-size: 14px; }
        .ov-name {
          margin: 2px 0 0; font-family: var(--font-space-grotesk), sans-serif;
          font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: var(--cab-text);
        }
        .ov-code {
          display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 999px;
          font-family: var(--font-jetbrains-mono), monospace; font-size: 12px; font-weight: 500;
          color: var(--cab-green-deep);
          background: color-mix(in srgb, var(--cab-green) 13%, transparent);
          border: 1px solid color-mix(in srgb, var(--cab-green) 24%, transparent);
        }

        .ov-bento { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .ov-card {
          position: relative; display: flex; flex-direction: column; gap: 8px;
          padding: 16px; border-radius: var(--cab-radius-md);
          background: var(--cab-surface); border: 1px solid var(--cab-border);
          box-shadow: var(--cab-shadow-sm); text-decoration: none; color: var(--cab-text);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        a.ov-card:hover { transform: translateY(-2px); box-shadow: var(--cab-shadow-md); }

        .ov-card-label { font-size: 12px; font-weight: 600; color: var(--cab-muted); }
        .ov-card-top, .ov-hero-top { display: flex; align-items: center; gap: 8px; }
        .ov-card-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 9px;
        }
        .ov-card-icon--amber { color: var(--cab-amber); background: color-mix(in srgb, var(--cab-amber) 16%, transparent); }
        .ov-card-icon--mint { color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-mint) 26%, transparent); }
        .ov-num { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .ov-money { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--cab-text); }

        .ov-hero {
          grid-column: 1 / -1;
          background:
            radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--cab-green) 18%, transparent) 0%, transparent 55%),
            var(--cab-surface);
          border-color: color-mix(in srgb, var(--cab-green) 22%, var(--cab-border));
        }
        .ov-hero-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 10px; color: #fff;
          background: linear-gradient(150deg, var(--cab-green), var(--cab-green-deep));
          box-shadow: 0 6px 14px color-mix(in srgb, var(--cab-green) 40%, transparent);
        }
        .ov-hero-num { font-family: var(--font-space-grotesk), sans-serif; font-size: 44px; font-weight: 700; line-height: 1; letter-spacing: -0.03em; }
        .ov-hero-sub { font-size: 12.5px; color: var(--cab-muted); }

        .ov-latest { gap: 14px; }
        .ov-latest-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .ov-latest-num { display: block; margin-top: 3px; font-family: var(--font-jetbrains-mono), monospace; font-size: 15px; font-weight: 600; color: var(--cab-text); }

        .ov-timeline { display: flex; align-items: center; }
        .ov-step { display: flex; align-items: center; flex: 1; }
        .ov-step:last-child { flex: 0; }
        .ov-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--cab-border-strong); flex-shrink: 0; transition: background 0.2s; }
        .ov-dot--on { background: var(--cab-green); box-shadow: 0 0 0 4px color-mix(in srgb, var(--cab-green) 16%, transparent); }
        .ov-line { flex: 1; height: 3px; margin: 0 4px; border-radius: 2px; background: var(--cab-border-strong); }
        .ov-line--on { background: var(--cab-green); }
        .ov-timeline-labels { display: flex; justify-content: space-between; }
        .ov-timeline-labels span { font-size: 10px; color: var(--cab-muted); flex: 1; text-align: left; }
        .ov-timeline-labels span:last-child { flex: 0; text-align: right; white-space: nowrap; }

        .ov-empty { align-items: center; text-align: center; gap: 6px; padding: 28px 16px; }
        .ov-empty-icon { color: var(--cab-muted); opacity: 0.6; }
        .ov-empty-title { margin: 4px 0 0; font-weight: 700; font-size: 15px; }
        .ov-empty-sub { margin: 0; font-size: 12.5px; color: var(--cab-muted); }

        .ov-recent { display: flex; flex-direction: column; gap: 10px; }
        .ov-recent-head { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
        .ov-recent-title { margin: 0; font-size: 15px; font-weight: 700; }
        .ov-recent-all { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--cab-green-deep); text-decoration: none; }
        .ov-recent-empty { margin: 0; padding: 4px; color: var(--cab-muted); font-size: 13px; }

        .ov-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .ov-row {
          display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 10px;
          padding: 12px 14px; border-radius: var(--cab-radius-sm);
          background: var(--cab-surface); border: 1px solid var(--cab-border);
          text-decoration: none; color: var(--cab-text); box-shadow: var(--cab-shadow-sm);
          transition: transform 0.14s ease;
        }
        .ov-row:hover { transform: translateY(-1px); }
        .ov-row-num { font-family: var(--font-jetbrains-mono), monospace; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ov-row-mid { display: inline-flex; align-items: center; gap: 8px; }
        .ov-row-date { font-size: 11.5px; color: var(--cab-muted); white-space: nowrap; }
        .ov-row-sum { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 13.5px; white-space: nowrap; }

        .ov-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 4px; padding: 14px; border-radius: var(--cab-radius-md);
          font-size: 15px; font-weight: 700; color: #fff; text-decoration: none;
          background: linear-gradient(150deg, var(--cab-green) 0%, var(--cab-green-deep) 100%);
          box-shadow: 0 10px 24px color-mix(in srgb, var(--cab-green) 38%, transparent);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .ov-cta:hover { transform: translateY(-2px); box-shadow: 0 14px 30px color-mix(in srgb, var(--cab-green) 44%, transparent); }
        .ov-cta--off { opacity: 0.45; pointer-events: none; box-shadow: none; cursor: default; }

        @media (max-width: 360px) {
          .ov-bento { grid-template-columns: 1fr; }
        }

        @media (min-width: 1024px) {
          .ov-bento { grid-template-columns: repeat(3, 1fr); }
          .ov-cta { align-self: start; padding-left: 28px; padding-right: 28px; }
        }
      `}</style>
    </div>
  );
}
