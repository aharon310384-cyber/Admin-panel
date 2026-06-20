"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParcelStatus } from "@prisma/client";
import { applyParcelServices, setParcelStatus, setParcelPaid } from "@/actions/parcel-form";
import { parcelStatusLabel } from "@/lib/statuses";

const NEXT: Partial<Record<ParcelStatus, ParcelStatus>> = {
  FORMED: "ASSEMBLED",
  ASSEMBLED: "PACKED",
  PACKED: "READY_TO_SHIP",
  READY_TO_SHIP: "SHIPPED",
  SHIPPED: "DELIVERED",
};

type Props = {
  parcelId: string;
  status: ParcelStatus;
  isPaid: boolean;
  initial: {
    consolidation: boolean;
    compactPack: boolean;
    standardCheck: boolean;
    reinforcedPackUsd: string;
    localDeliveryUsd: string;
    insurancePercent: string;
    discountPercent: string;
  };
};

export default function ParcelControls({ parcelId, status, isPaid, initial }: Props) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const recalc = async () => {
    setBusy(true); setMsg(null);
    await applyParcelServices(parcelId, {
      consolidation: f.consolidation,
      compactPack: f.compactPack,
      standardCheck: f.standardCheck,
      reinforcedPackUsd: Number(f.reinforcedPackUsd) || 0,
      localDeliveryUsd: Number(f.localDeliveryUsd) || 0,
      insurancePercent: Number(f.insurancePercent) || 0,
      discountPercent: Number(f.discountPercent) || 0,
    });
    setBusy(false); router.refresh();
  };

  const advance = async () => {
    const next = NEXT[status];
    if (!next) return;
    setBusy(true); setMsg(null);
    const r = await setParcelStatus(parcelId, next);
    setBusy(false);
    if (!r.ok) setMsg(r.error ?? "Ошибка");
    else router.refresh();
  };

  const togglePaid = async () => {
    setBusy(true);
    await setParcelPaid(parcelId, !isPaid);
    setBusy(false); router.refresh();
  };

  const chk = (k: keyof typeof f) => (
    <input type="checkbox" checked={f[k] as boolean} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.checked }))} />
  );
  const num = (k: keyof typeof f, ph: string) => (
    <input className="pc-num" type="number" min="0" step="0.01" placeholder={ph}
      value={f[k] as string} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} />
  );

  return (
    <div className="pc">
      <div className="pc-block">
        <h3 className="pc-h">Услуги и расчёт</h3>
        <label className="pc-row">{chk("consolidation")} Консолидация (0.3 $/кг)</label>
        <label className="pc-row">{chk("compactPack")} Компактная упаковка (0.5 $/кг)</label>
        <label className="pc-row">{chk("standardCheck")} Стандартная проверка (1.0 $/кг)</label>
        <label className="pc-row">Усиленная упаковка, $ {num("reinforcedPackUsd", "по факту")}</label>
        <label className="pc-row">Доставка до склада, $ {num("localDeliveryUsd", "по факту")}</label>
        <label className="pc-row">Страховка, % {num("insurancePercent", "2–10")}</label>
        <label className="pc-row">Скидка, % {num("discountPercent", "0")}</label>
        <button className="pc-btn pc-btn--accent" disabled={busy} onClick={recalc}>Пересчитать квитанцию</button>
      </div>

      <div className="pc-block">
        <h3 className="pc-h">Статус и оплата</h3>
        <p className="pc-status">Текущий: <b>{parcelStatusLabel(status)}</b></p>
        {NEXT[status] && (
          <button className="pc-btn pc-btn--accent" disabled={busy} onClick={advance}>
            → {parcelStatusLabel(NEXT[status]!)}
          </button>
        )}
        <button className={`pc-btn ${isPaid ? "pc-btn--paid" : "pc-btn--outline"}`} disabled={busy} onClick={togglePaid}>
          {isPaid ? "✓ Оплачено (снять)" : "Отметить оплаченным"}
        </button>
        {msg && <p className="pc-err">{msg}</p>}
      </div>

      <style>{`
        .pc { display: flex; flex-direction: column; gap: 16px; }
        .pc-block { display: flex; flex-direction: column; gap: 8px; }
        .pc-h { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: var(--color-text); }
        .pc-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text); }
        .pc-num { width: 90px; margin-left: auto; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; }
        .pc-status { margin: 0; font-size: 13px; color: var(--color-muted); }
        .pc-btn { padding: 9px 14px; border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .pc-btn:disabled { opacity: 0.5; cursor: default; }
        .pc-btn--accent { color: #fff; background: var(--color-accent); }
        .pc-btn--outline { color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border); }
        .pc-btn--paid { color: var(--color-status-completed); background: var(--color-status-completed-bg); }
        .pc-err { margin: 0; font-size: 12.5px; color: var(--color-status-canceled); }
      `}</style>
    </div>
  );
}
