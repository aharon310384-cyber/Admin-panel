"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ListChecks, X } from "lucide-react";
import type { ParcelStatus } from "@prisma/client";
import { findParcelsByTracks, setParcelsStatus, type TrackMatch } from "@/actions/parcel-form";
import { PARCEL_STATUS_LABELS, parcelStatusLabel } from "@/lib/statuses";

// «Статус по трек-номерам»: вставить список номеров (из письма перевозчика, таблицы) → найти посылки → поставить статус.
// Ручной инструмент на крайний случай, когда отслеживание не помогло.

const STATUS_OPTIONS = Object.entries(PARCEL_STATUS_LABELS) as [ParcelStatus, string][];

export default function StatusByTracks() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [found, setFound] = useState<TrackMatch[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<ParcelStatus>("DELIVERED");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setText("");
    setFound(null);
    setMissing([]);
    setChecked(new Set());
    setMessage(null);
  };

  const search = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await findParcelsByTracks(text);
      setFound(result.found);
      setMissing(result.missing);
      setChecked(new Set(result.found.filter((p) => p.status !== status).map((p) => p.id)));
    });

  const apply = () =>
    startTransition(async () => {
      const label = PARCEL_STATUS_LABELS[status];
      const result = await setParcelsStatus([...checked], status);
      setMessage({ ok: result.ok, text: [`Статус «${label}» поставлен: ${result.changed}`, ...result.errors].join(". ") });
      const again = await findParcelsByTracks(text);
      setFound(again.found);
      setChecked(new Set());
      router.refresh();
    });

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog.Root open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
      <Dialog.Trigger asChild>
        <button type="button" className="cmd" data-command="status-by-tracks">
          <ListChecks size={15} />
          Статус по трек-номерам
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sbt-overlay" />
        <Dialog.Content className="sbt-dialog" aria-describedby={undefined}>
          <div className="sbt-head">
            <Dialog.Title className="sbt-title">Статус по трек-номерам</Dialog.Title>
            <Dialog.Close className="sbt-x" aria-label="Закрыть"><X size={17} /></Dialog.Close>
          </div>
          <p className="sbt-hint">Вставьте трек-номера посылок — через пробел, запятую или каждый с новой строки. Система найдёт посылки, отметьте нужные и поставьте статус.</p>
          <textarea
            className="sbt-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={"CK000132491MG\nLP00123456789CN"}
            spellCheck={false}
          />
          <div className="sbt-row">
            <button type="button" className="sbt-btn" onClick={search} disabled={pending || !text.trim()}>Найти посылки</button>
            {found && <span className="sbt-muted">Найдено: {found.length}{missing.length ? `, не найдено: ${missing.length}` : ""}</span>}
          </div>

          {found && found.length > 0 && (
            <div className="sbt-list">
              <table>
                <thead>
                  <tr><th /><th>Трек-номер</th><th>Посылка</th><th>Клиент</th><th>Статус сейчас</th></tr>
                </thead>
                <tbody>
                  {found.map((p) => (
                    <tr key={p.id}>
                      <td><input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Отметить ${p.trackingNumber}`} /></td>
                      <td className="sbt-mono">{p.trackingNumber}</td>
                      <td className="sbt-mono">{p.number}</td>
                      <td>{p.customerCode ?? "—"}</td>
                      <td>{parcelStatusLabel(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {missing.length > 0 && <p className="sbt-missing">Не найдены: <span className="sbt-mono">{missing.join(", ")}</span></p>}
          {message && <p className={message.ok ? "sbt-ok" : "sbt-error"} role="status">{message.text}</p>}

          <div className="sbt-foot">
            <select className="sbt-select" value={status} onChange={(e) => setStatus(e.target.value as ParcelStatus)} aria-label="Новый статус">
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" className="sbt-btn sbt-btn--primary" onClick={apply} disabled={pending || checked.size === 0}>
              Поставить статус ({checked.size})
            </button>
            <Dialog.Close className="sbt-btn">Закрыть</Dialog.Close>
          </div>

          <style>{`
            .sbt-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(31, 26, 20, 0.35); }
            .sbt-dialog {
              position: fixed; z-index: 61; top: max(12px, 6dvh); left: 50%; transform: translateX(-50%);
              width: min(680px, calc(100vw - 24px)); max-height: calc(100dvh - 24px - max(12px, 6dvh)); overflow-y: auto;
              background: #fffcf6; border: 1px solid var(--color-border); border-radius: var(--radius-md);
              box-shadow: var(--shadow); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; font-size: 13px;
            }
            .sbt-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
            .sbt-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--color-text); }
            .sbt-x { display: inline-flex; border: none; background: none; cursor: pointer; padding: 5px; border-radius: var(--radius-sm); color: var(--color-muted); }
            .sbt-x:hover { color: var(--color-text); background: var(--color-muted-bg); }
            .sbt-hint, .sbt-muted { margin: 0; color: var(--color-muted); line-height: 1.45; }
            .sbt-text { width: 100%; padding: 8px 10px; font-family: var(--font-mono); font-size: 13px; border: 1px solid var(--color-border-strong); border-radius: 4px; background: #fff; resize: vertical; }
            .sbt-row, .sbt-foot { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
            .sbt-foot { justify-content: flex-end; }
            .sbt-list { max-height: 40dvh; overflow: auto; border: 1px solid var(--color-border-strong); border-radius: 4px; background: #fff; }
            .sbt-list table { width: 100%; border-collapse: collapse; }
            .sbt-list th { text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; color: var(--color-muted); border-bottom: 1px solid var(--color-border); position: sticky; top: 0; background: #fff; }
            .sbt-list td { padding: 5px 8px; border-bottom: 1px solid var(--color-border); white-space: nowrap; }
            .sbt-list input { margin: 0; accent-color: var(--color-accent); }
            .sbt-mono { font-family: var(--font-mono); }
            .sbt-missing { margin: 0; color: var(--color-warning); word-break: break-word; }
            .sbt-ok { margin: 0; color: var(--color-success); }
            .sbt-error { margin: 0; color: var(--color-danger); }
            .sbt-select { height: 30px; padding: 0 8px; border: 1px solid var(--color-border-strong); border-radius: 4px; font: inherit; background: #fff; }
            .sbt-btn { padding: 5px 14px; font: inherit; color: var(--color-text); background: #fff; border: 1px solid var(--color-border-strong); border-radius: 4px; cursor: pointer; }
            .sbt-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
            .sbt-btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; font-weight: 600; }
            .sbt-btn--primary:hover:not(:disabled) { background: var(--color-accent-hover); }
            .sbt-btn:disabled { opacity: 0.6; cursor: default; }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
