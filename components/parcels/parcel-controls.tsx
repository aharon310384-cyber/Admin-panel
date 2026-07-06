"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParcelStatus } from "@prisma/client";
import { applyParcelServices, setParcelStatus, setParcelPaid, setParcelTracking } from "@/actions/parcel-form";
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
    actualWeightKg: string;
    billableWeightKg: string;
    lengthCm: string;
    widthCm: string;
    heightCm: string;
    volumetricDivisor: number;
    consolidation: boolean;
    compactPack: boolean;
    standardCheck: boolean;
    reinforcedPackUsd: string;
    localDeliveryUsd: string;
    insurancePercent: string;
    discountPercent: string;
    trackingNumber: string;
  };
};

export default function ParcelControls({ parcelId, status, isPaid, initial }: Props) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [track, setTrack] = useState(initial.trackingNumber);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);

  const recalc = async () => {
    setBusy(true); setMsg(null);
    const r = await applyParcelServices(parcelId, {
      actualWeightKg: Number(f.actualWeightKg) || 0,
      billableWeightKg: Number(f.billableWeightKg) || 0,
      lengthCm: Number(f.lengthCm) || 0,
      widthCm: Number(f.widthCm) || 0,
      heightCm: Number(f.heightCm) || 0,
      consolidation: f.consolidation,
      compactPack: f.compactPack,
      standardCheck: f.standardCheck,
      reinforcedPackUsd: Number(f.reinforcedPackUsd) || 0,
      localDeliveryUsd: Number(f.localDeliveryUsd) || 0,
      insurancePercent: Number(f.insurancePercent) || 0,
      discountPercent: Number(f.discountPercent) || 0,
    });
    setBusy(false);
    setMsg(r?.warning ?? null);
    router.refresh();
  };

  const saveTrack = async () => {
    setBusy(true); setTrackMsg(null);
    await setParcelTracking(parcelId, track);
    setBusy(false); setTrackMsg("Сохранено");
    router.refresh();
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

  // Живой объёмный вес = Д × Ш × В (см) ÷ делитель
  const L = Number(f.lengthCm) || 0, W = Number(f.widthCm) || 0, H = Number(f.heightCm) || 0;
  const volumetric = L > 0 && W > 0 && H > 0 ? Math.round((L * W * H) / f.volumetricDivisor * 100) / 100 : 0;

  return (
    <div className="pc">
      <div className="pc-block">
        <h3 className="pc-h">Вес и габариты</h3>
        <label className="pc-field"><span>Фактический вес, кг</span>{num("actualWeightKg", "0")}</label>
        <div className="pc-field pc-field--dims">
          <span>Габариты, см (Д×Ш×В)</span>
          <div className="pc-dims">
            {num("lengthCm", "Д")}<i>×</i>{num("widthCm", "Ш")}<i>×</i>{num("heightCm", "В")}
          </div>
        </div>
        <p className="pc-vol">Объёмный вес: <b>{volumetric || "—"}</b> кг <span className="pc-muted">(÷{f.volumetricDivisor})</span></p>
        <label className="pc-field"><span>Расчётный вес, кг</span>{num("billableWeightKg", "авто = max")}</label>
        <p className="pc-hint">Пусто → авто max(факт, объёмный).</p>
      </div>

      <div className="pc-block">
        <h3 className="pc-h">Услуги</h3>
        <label className="pc-check">{chk("consolidation")} <span>Консолидация <i>0.3 $/кг</i></span></label>
        <label className="pc-check">{chk("compactPack")} <span>Компактная упаковка <i>0.5 $/кг</i></span></label>
        <label className="pc-check">{chk("standardCheck")} <span>Стандартная проверка <i>1.0 $/кг</i></span></label>
        <label className="pc-field"><span>Усиленная упаковка, $</span>{num("reinforcedPackUsd", "факт")}</label>
        <label className="pc-field"><span>Доставка до склада, $</span>{num("localDeliveryUsd", "факт")}</label>
        <label className="pc-field"><span>Страховка, %</span>{num("insurancePercent", "2–10")}</label>
        <label className="pc-field"><span>Скидка, %</span>{num("discountPercent", "0")}</label>
        <button className="pc-btn pc-btn--accent" disabled={busy} onClick={recalc}>Пересчитать квитанцию</button>
        {msg && <p className="pc-err">{msg}</p>}
      </div>

      <div className="pc-block">
        <h3 className="pc-h">Статус и отправка</h3>
        <p className="pc-status">Текущий: <b>{parcelStatusLabel(status)}</b></p>
        {NEXT[status] && (
          <button className="pc-btn pc-btn--accent" disabled={busy} onClick={advance}>
            → {parcelStatusLabel(NEXT[status]!)}
          </button>
        )}
        <button className={`pc-btn ${isPaid ? "pc-btn--paid" : "pc-btn--outline"}`} disabled={busy} onClick={togglePaid}>
          {isPaid ? "✓ Оплачено (снять)" : "Отметить оплаченным"}
        </button>
        <label className="pc-field pc-field--col"><span>Трек отслеживания</span>
          <input className="pc-track" type="text" placeholder="напр. RS123456789CN"
            value={track} onChange={(e) => setTrack(e.target.value)} />
        </label>
        <button className="pc-btn pc-btn--outline" disabled={busy} onClick={saveTrack}>Сохранить трек</button>
        {trackMsg && <p className="pc-ok">{trackMsg}</p>}
      </div>

      <style>{`
        .pc { display: flex; flex-direction: column; gap: 20px; }
        .pc-block { display: flex; flex-direction: column; gap: 10px; }
        .pc-block + .pc-block { padding-top: 20px; border-top: 1px solid var(--color-border); }
        .pc-h { margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--color-muted); }
        .pc-field { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; color: var(--color-text); }
        .pc-field--col { flex-direction: column; align-items: stretch; gap: 5px; }
        .pc-field--dims { align-items: center; }
        .pc-num { width: 96px; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; text-align: right; background: var(--color-surface); }
        .pc-dims { display: flex; align-items: center; gap: 4px; }
        .pc-dims .pc-num { width: 48px; text-align: center; padding: 6px 4px; }
        .pc-dims i { color: var(--color-muted); font-style: normal; }
        .pc-vol { margin: 0; font-size: 13px; color: var(--color-text); }
        .pc-muted { color: var(--color-muted); }
        .pc-hint { margin: 0; font-size: 11.5px; color: var(--color-muted); line-height: 1.4; }
        .pc-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text); }
        .pc-check i, .pc-field i { font-style: normal; color: var(--color-muted); font-size: 12px; }
        .pc-status { margin: 0; font-size: 13px; color: var(--color-muted); }
        .pc-track { padding: 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-family: var(--font-mono); background: var(--color-surface); }
        .pc-btn { margin-top: 4px; padding: 9px 14px; border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s, background 0.15s; }
        .pc-btn:disabled { opacity: 0.5; cursor: default; }
        .pc-btn--accent { color: var(--color-accent-fg); background: var(--color-accent); }
        .pc-btn--accent:hover:not(:disabled) { background: var(--color-accent-hover); }
        .pc-btn--outline { color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border); }
        .pc-btn--outline:hover:not(:disabled) { background: var(--color-muted-bg); }
        .pc-btn--paid { color: var(--color-success); background: var(--color-success-bg); }
        .pc-err { margin: 0; font-size: 12.5px; color: var(--color-danger); }
        .pc-ok { margin: 0; font-size: 12.5px; color: var(--color-success); }
      `}</style>
    </div>
  );
}
