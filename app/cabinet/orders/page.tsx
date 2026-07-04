import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Boxes, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Заказы" };

type FilterKey = "active" | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "active", label: "Активные" },
  { key: "all", label: "Все" },
];

function filterWhere(key: FilterKey): Prisma.OrderWhereInput {
  return key === "active"
    ? { status: { notIn: ["FORMED", "RETURNED", "UTILIZED"] } }
    : {};
}

export default async function ClientCabinetOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { client } = await getClientCabinetContext();
  const { filter } = await searchParams;
  const active: FilterKey = filter === "all" ? "all" : "active";

  const products = await prisma.order.findMany({
    where: {
      deletedAt: null,
      customerId: client.id,
      ...filterWhere(active),
    },
    select: {
      id: true,
      productNameText: true,
      trackNumber: true,
      customerComment: true,
      unitPriceUsd: true,
      quantity: true,
      imageUrl: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="or">
      <header className="or-head">
        <h1 className="or-title">Заказы</h1>
        <span className="or-count">{products.length}</span>
      </header>

      <div className="or-filters">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "active" ? "/cabinet/orders" : `/cabinet/orders?filter=${f.key}`}
            className={`or-chip ${active === f.key ? "or-chip--on" : ""}`}
            scroll={false}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="or-empty">
          <Boxes size={30} className="or-empty-icon" />
          <p className="or-empty-title">Заказов пока нет</p>
          <p className="or-empty-sub">Оформите заказ — товары появятся здесь</p>
        </div>
      ) : (
        <ul className="or-list">
          {products.map((p) => (
            <li key={p.id} className="or-card">
              <span className="or-thumb">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt="" width={56} height={56} className="or-thumb-img" />
                ) : (
                  <Boxes size={22} className="or-thumb-ph" />
                )}
              </span>
              <span className="or-info">
                <span className="or-name">{p.productNameText ?? "—"}</span>
                <span className="or-sku">{p.trackNumber ?? ""}</span>
                {p.customerComment?.trim() ? (
                  <span className="or-comment">💬 {p.customerComment}</span>
                ) : null}
              </span>
              <span className="or-right">
                <span className="or-price">{p.unitPriceUsd != null ? formatUsd(p.unitPriceUsd) : "—"}</span>
                <span className={`or-stock ${p.quantity > 0 ? "or-stock--ok" : "or-stock--out"}`}>
                  {p.quantity > 0 ? `${p.quantity} шт.` : "Нет"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <span className="or-cta or-cta--off" aria-disabled="true" title="Скоро">
        <Plus size={18} strokeWidth={2.5} />
        Оформить заказ
      </span>

      <style>{`
        .or { display: flex; flex-direction: column; gap: 14px; padding-bottom: 8px; }

        .or-head { display: flex; align-items: center; gap: 10px; padding: 8px 4px 0; }
        .or-title { margin: 0; font-family: var(--font-space-grotesk), sans-serif; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
        .or-count {
          display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 24px;
          padding: 0 8px; border-radius: 999px; font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums;
          color: var(--cab-green-deep); background: color-mix(in srgb, var(--cab-green) 14%, transparent);
        }

        .or-filters { display: flex; gap: 8px; padding: 2px 4px; }
        .or-chip {
          padding: 7px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
          color: var(--cab-text-soft); text-decoration: none; background: var(--cab-surface);
          border: 1px solid var(--cab-border); transition: all 0.15s;
        }
        .or-chip:hover { border-color: var(--cab-border-strong); }
        .or-chip--on {
          color: #fff; border-color: transparent;
          background: linear-gradient(150deg, var(--cab-green), var(--cab-green-deep));
          box-shadow: 0 6px 14px color-mix(in srgb, var(--cab-green) 34%, transparent);
        }

        .or-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .or-card {
          display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px;
          padding: 12px; border-radius: var(--cab-radius-md);
          background: var(--cab-surface); border: 1px solid var(--cab-border); box-shadow: var(--cab-shadow-sm);
        }
        .or-thumb {
          display: inline-flex; align-items: center; justify-content: center;
          width: 56px; height: 56px; border-radius: 12px; overflow: hidden; flex-shrink: 0;
          background: color-mix(in srgb, var(--cab-green) 8%, var(--cab-surface));
          border: 1px solid var(--cab-border);
        }
        .or-thumb-img { width: 56px; height: 56px; object-fit: cover; }
        .or-thumb-ph { color: var(--cab-muted); opacity: 0.6; }
        .or-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .or-name { font-size: 14px; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .or-sku { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: var(--cab-muted); }
        .or-comment { font-size: 11.5px; color: var(--cab-text-soft); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .or-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
        .or-price { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 14.5px; white-space: nowrap; }
        .or-stock { font-size: 11px; font-weight: 600; }
        .or-stock--ok { color: var(--cab-green-deep); }
        .or-stock--out { color: var(--cab-muted); }

        .or-empty {
          display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px;
          padding: 40px 16px; border-radius: var(--cab-radius-md);
          background: var(--cab-surface); border: 1px solid var(--cab-border);
        }
        .or-empty-icon { color: var(--cab-muted); opacity: 0.55; }
        .or-empty-title { margin: 4px 0 0; font-weight: 700; font-size: 15px; }
        .or-empty-sub { margin: 0; font-size: 12.5px; color: var(--cab-muted); }

        .or-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 2px; padding: 14px; border-radius: var(--cab-radius-md);
          font-size: 15px; font-weight: 700; color: #fff; text-decoration: none;
          background: linear-gradient(150deg, var(--cab-green) 0%, var(--cab-green-deep) 100%);
          box-shadow: 0 10px 24px color-mix(in srgb, var(--cab-green) 38%, transparent);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .or-cta:hover { transform: translateY(-2px); box-shadow: 0 14px 30px color-mix(in srgb, var(--cab-green) 44%, transparent); }
        .or-cta--off { opacity: 0.45; pointer-events: none; box-shadow: none; cursor: default; }

        @media (min-width: 1024px) {
          .or-cta { display: none; }
        }
      `}</style>
    </div>
  );
}
