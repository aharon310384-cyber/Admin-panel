"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";

type Props = {
  productId: string;
  deleteAction: (id: string) => Promise<{ error?: string } | void>;
};

export default function DeleteProductButton({ productId, deleteAction }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteAction(productId);
      if (result?.error) {
        toast.error(result.error);
        setConfirm(false);
      } else {
        toast.success("Услуга удалена");
        router.push("/products");
      }
    } catch {
      toast.error("Ошибка при удалении");
    } finally {
      setLoading(false);
    }
  };

  if (confirm) {
    return (
      <div className="confirm">
        <span className="confirm-text">Удалить?</span>
        <button type="button" className="btn-danger" onClick={handleDelete} disabled={loading}>
          {loading ? <Loader2 size={13} className="spin" /> : null}
          Да
        </button>
        <button type="button" className="btn-cancel" onClick={() => setConfirm(false)}>
          Нет
        </button>
        <style>{`
          .confirm { display: flex; align-items: center; gap: 6px; background: var(--color-danger-bg); border: 1px solid var(--color-danger); border-radius: var(--radius-sm); padding: 7px 12px; }
          .confirm-text { font-size: 13px; color: var(--color-danger); font-weight: 500; }
          .btn-danger { display: flex; align-items: center; gap: 4px; padding: 5px 10px; background: var(--color-danger); border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; color: white; cursor: pointer; }
          .btn-danger:disabled { opacity: 0.7; cursor: not-allowed; }
          .btn-cancel { padding: 5px 10px; background: none; border: none; font-size: 12px; color: var(--color-muted); cursor: pointer; font-family: var(--font-sans); }
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
        .btn-delete { display: flex; align-items: center; gap: 6px; padding: 9px 14px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--color-muted); cursor: pointer; font-family: var(--font-sans); transition: all 0.15s; }
        .btn-delete:hover { color: var(--color-danger); border-color: var(--color-danger); background: var(--color-danger-bg); }
      `}</style>
    </>
  );
}
