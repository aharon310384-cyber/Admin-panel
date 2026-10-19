"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setParcelInternalComments } from "@/actions/parcel-form";

// Карточка посылки → «Внутренние комментарии»: к задаче и к посылке. Видят только сотрудники, клиент — нет.

export default function InternalComments({ parcelId, parcel, task, hasTask }: { parcelId: string; parcel: string; task: string; hasTask: boolean }) {
  const router = useRouter();
  const [parcelText, setParcelText] = useState(parcel);
  const [taskText, setTaskText] = useState(task);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = parcelText !== parcel || taskText !== task;

  const save = () =>
    startTransition(async () => {
      const result = await setParcelInternalComments(parcelId, { parcel: parcelText, task: taskText });
      setMessage(result.ok ? "Сохранено" : result.error ?? "Не сохранилось");
      router.refresh();
    });

  return (
    <div className="ic">
      {hasTask && (
        <label className="ic-field">
          <span>К задаче</span>
          <textarea rows={2} value={taskText} onChange={(e) => { setTaskText(e.target.value); setMessage(null); }} />
        </label>
      )}
      <label className="ic-field">
        <span>К посылке</span>
        <textarea rows={2} value={parcelText} onChange={(e) => { setParcelText(e.target.value); setMessage(null); }} />
      </label>
      <div className="ic-actions">
        <button type="button" className="ic-btn" onClick={save} disabled={pending || !changed}>Сохранить</button>
        {message && <span className="ic-msg" role="status">{message}</span>}
        <span className="ic-hint">Клиент не видит</span>
      </div>
      <style>{`
        .ic { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
        .ic-field { display: flex; flex-direction: column; gap: 4px; color: var(--color-muted); }
        .ic-field textarea { padding: 6px 9px; border: 1px solid var(--color-border-strong); border-radius: 4px; font: inherit; color: var(--color-text); background: #fff; resize: vertical; }
        .ic-field textarea:focus { outline: none; border-color: var(--color-accent); }
        .ic-actions { display: flex; align-items: center; gap: 10px; }
        .ic-btn { padding: 4px 12px; border: 1px solid var(--color-border-strong); border-radius: 4px; background: #fff; font: inherit; cursor: pointer; }
        .ic-btn:hover:not(:disabled) { background: var(--color-muted-bg); }
        .ic-btn:disabled { opacity: 0.55; cursor: default; }
        .ic-msg { color: var(--color-success); }
        .ic-hint { margin-left: auto; color: var(--color-muted); font-size: 12px; }
      `}</style>
    </div>
  );
}
