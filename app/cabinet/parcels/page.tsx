import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import type { ParcelStatus, Prisma } from "@prisma/client";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { prisma } from "@/lib/prisma";
import StatusPill, { statusLabel } from "@/components/cabinet/status-pill";
import { formatUsd, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Посылки" };

const TIMELINE: ParcelStatus[] = ["NEW", "PROCESSING", "SHIPPED", "COMPLETED"];

type FilterKey = "all" | "active" | "done";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "В работе" },
  { key: "done", label: "Завершённые" },
];

function filterWhere(key: FilterKey): Prisma.ParcelWhereInput {
  if (key === "active") return { status: { in: ["NEW", "PROCESSING", "SHIPPED", "PAID"] } };
  if (key === "done") return { status: { in: ["COMPLETED", "RETURNED_PAID", "RETURNED_UNPAID", "CANCELED"] } };
  return {};
}

export default async function ClientCabinetParcelsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { client } = await getClientCabinetContext();
  const { filter } = await searchParams;
  const active: FilterKey =
    filter === "active" || filter === "done" ? filter : "all";

  const codeVariants = Array.from(
    new Set([client.code, client.code.toUpperCase(), client.code.toLowerCase()])
  );

  const parcels = await prisma.parcel.findMany({
    where: {
      deletedAt: null,
      routePrefix: { in: codeVariants },
      ...filterWhere(active),
    },
    select: {
      id: true,
      number: true,
      status: true,
      totalUsd: true,
      isPaid: true,
      weightKg: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="pc">
      <header className="pc-head">
        <h1 className="pc-title">Посылки</h1>
        <span className="pc-count">{parcels.length}</span>
      </header>

      <div className="pc-filters" role="tablist">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/cabinet/parcels" : `/cabinet/parcels?filter=${f.key}`}
            className={`pc-chip ${active === f.key ? "pc-chip--on" : ""}`}
            scroll={false}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {parcels.length === 0 ? (
        <div className="pc-empty">
          <Package size={30} className="pc-empty-icon" />
          <p className="pc-empty-title">Здесь пусто</p>
          <p className="pc-empty-sub">Посылки появятся после оформления заказа</p>
        </div>
      ) : (
        <ul className="pc-list">
          {parcels.map((p) => {
            const step = TIMELINE.indexOf(p.status);
            return (
              <li key={p.id}>
                <Link href={`/cabinet/parcels/${p.id}`} className="pc-card">
                <div className="pc-card-head">
                  <div className="pc-card-id">
                    <span className="pc-num">{p.number}</span>
                    <span className="pc-meta">
                      {p._count.items} поз. · {formatDate(p.createdAt)}
                    </span>
                  </div>
                  <StatusPill status={p.status} />
                </div>

                {step >= 0 && (
                  <div className="pc-timeline" aria-hidden="true">
                    {TIMELINE.map((s, i) => {
                      const reached = i <= step;
                      const isLast = i === TIMELINE.length - 1;
                      return (
                        <div key={s} className="pc-tstep">
                          <span className={`pc-dot ${reached ? "pc-dot--on" : ""}`} />
                          {!isLast && (
                            <span className={`pc-line ${i < step ? "pc-line--on" : ""}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {step >= 0 && (
                  <div className="pc-tlabels">
                    {TIMELINE.map((s) => (
                      <span key={s}>{statusLabel(s)}</span>
                    ))}
                  </div>
                )}

                <div className="pc-card-foot">
                  <span className={`pc-pay ${p.isPaid ? "pc-pay--ok" : "pc-pay--due"}`}>
                    {p.isPaid ? "Оплачено" : "К оплате"}
                  </span>
                  <span className="pc-sum">{formatUsd(p.totalUsd)}</span>
                </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <span className="pc-cta pc-cta--off" aria-disabled="true" title="Скоро">
        <Plus size={18} strokeWidth={2.5} />
        Оформить заказ
      </span>

      <style>{`
        .pc { display: flex; flex-direction: column; gap: 14px; padding-bottom: 8px; }

        .pc-head { display: flex; align-items: center; gap: 10px; padding: 8px 4px 0; }
        .pc-title { margin: 0; font-family: var(--font-space-grotesk), sans-serif; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
        .pc-count {
          display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 24px;
          padding: 0 8px; border-radius: 999px; font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums;
          color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-green) 14%, transparent);
        }

        .pc-filters { display: flex; gap: 8px; overflow-x: auto; padding: 2px 4px; scrollbar-width: none; }
        .pc-filters::-webkit-scrollbar { display: none; }
        .pc-chip {
          flex-shrink: 0; padding: 7px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
          color: var(--cab-text-soft); text-decoration: none; background: var(--cab-surface);
          border: 1px solid var(--cab-border); transition: all 0.15s;
        }
        .pc-chip:hover { border-color: var(--cab-border-strong); }
        .pc-chip--on {
          color: #fff; border-color: transparent;
          background: linear-gradient(150deg, var(--cab-green), var(--cab-green-deep));
          box-shadow: 0 6px 14px color-mix(in srgb, var(--cab-green) 34%, transparent);
        }

        .pc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .pc-card {
          display: flex; flex-direction: column; gap: 12px; padding: 16px;
          border-radius: var(--cab-radius-md); background: var(--cab-surface);
          border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm);
          text-decoration: none; color: var(--cab-text);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .pc-card:hover { transform: translateY(-2px); box-shadow: var(--cab-shadow-md); }
        .pc-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .pc-card-id { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .pc-num { font-family: var(--font-jetbrains-mono), monospace; font-size: 14.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pc-meta { font-size: 11.5px; color: var(--cab-muted); }

        .pc-timeline { display: flex; align-items: center; margin-top: 2px; }
        .pc-tstep { display: flex; align-items: center; flex: 1; }
        .pc-tstep:last-child { flex: 0; }
        .pc-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--cab-border-strong); flex-shrink: 0; transition: background 0.2s; }
        .pc-dot--on { background: var(--cab-green); box-shadow: 0 0 0 4px color-mix(in srgb, var(--cab-green) 15%, transparent); }
        .pc-line { flex: 1; height: 3px; margin: 0 4px; border-radius: 2px; background: var(--cab-border-strong); }
        .pc-line--on { background: var(--cab-green); }
        .pc-tlabels { display: flex; justify-content: space-between; margin-top: -4px; }
        .pc-tlabels span { font-size: 9.5px; color: var(--cab-muted); flex: 1; text-align: left; }
        .pc-tlabels span:last-child { flex: 0; text-align: right; white-space: nowrap; }

        .pc-card-foot {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 10px; border-top: 1px solid var(--cab-border);
        }
        .pc-pay { font-size: 11.5px; font-weight: 600; }
        .pc-pay--ok { color: var(--cab-green-deep); }
        .pc-pay--due { color: var(--cab-amber); }
        .pc-sum { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 15px; }

        .pc-empty {
          display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px;
          padding: 40px 16px; border-radius: var(--cab-radius-md);
          background: var(--cab-surface); border: 1px solid var(--cab-border);
        }
        .pc-empty-icon { color: var(--cab-muted); opacity: 0.55; }
        .pc-empty-title { margin: 4px 0 0; font-weight: 700; font-size: 15px; }
        .pc-empty-sub { margin: 0; font-size: 12.5px; color: var(--cab-muted); }

        .pc-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 2px; padding: 14px; border-radius: var(--cab-radius-md);
          font-size: 15px; font-weight: 700; color: #fff; text-decoration: none;
          background: linear-gradient(150deg, var(--cab-green) 0%, var(--cab-green-deep) 100%);
          box-shadow: 0 10px 24px color-mix(in srgb, var(--cab-green) 38%, transparent);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .pc-cta:hover { transform: translateY(-2px); box-shadow: 0 14px 30px color-mix(in srgb, var(--cab-green) 44%, transparent); }
        .pc-cta--off { opacity: 0.45; pointer-events: none; box-shadow: none; cursor: default; }

        @media (min-width: 1024px) {
          .pc-cta { align-self: start; padding-left: 28px; padding-right: 28px; }
        }
      `}</style>
    </div>
  );
}
