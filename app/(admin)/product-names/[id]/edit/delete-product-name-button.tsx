"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

type Props = {
  productNameId: string;
  deleteAction: (id: string) => Promise<void>;
};

export default function DeleteProductNameButton({ productNameId, deleteAction }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    await deleteAction(productNameId);
  };

  if (confirm) {
    return (
      <div className="confirm">
        <span className="confirm-text">Удалить запись?</span>
        <button type="button" className="btn-danger" onClick={handleDelete} disabled={loading}>
          {loading ? <Loader2 size={13} className="spin" /> : null}
          Да, удалить
        </button>
        <button type="button" className="btn-cancel" onClick={() => setConfirm(false)}>
          Отмена
        </button>
        <style>{`
          .confirm { display: flex; align-items: center; gap: 8px; background: var(--color-danger-bg); border: 1px solid var(--color-danger); border-radius: var(--radius-sm); padding: 8px 12px; }
          .confirm-text { font-size: 13px; color: var(--color-danger); font-weight: 500; white-space: nowrap; }
          .btn-danger { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: var(--color-danger); border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; color: white; cursor: pointer; white-space: nowrap; }
          .btn-danger:disabled { opacity: 0.7; cursor: not-allowed; }
          .btn-cancel { padding: 6px 10px; background: none; border: none; font-size: 12px; color: var(--color-muted); cursor: pointer; font-family: var(--font-sans); white-space: nowrap; }
          .btn-cancel:hover { color: var(--color-text); }
          .spin { animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="btn-delete" onClick={() => setConfirm(true)}>
        <Trash2 size={14} />
        Удалить
      </button>
      <style>{`
        .btn-delete { display: flex; align-items: center; gap: 6px; padding: 9px 14px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-muted); cursor: pointer; font-family: var(--font-sans); transition: all 0.15s; white-space: nowrap; }
        .btn-delete:hover { color: var(--color-danger); border-color: var(--color-danger); background: var(--color-danger-bg); }
      `}</style>
    </>
  );
}
