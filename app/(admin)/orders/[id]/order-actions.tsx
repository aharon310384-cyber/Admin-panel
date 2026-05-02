"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Trash2, Loader2 } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_LABELS } from "@/types";
import { OrderStatusDot } from "@/components/ui/status-badge";

type Props = {
  orderId: string;
  currentStatus: OrderStatus;
  isAdmin: boolean;
  updateStatus: (id: string, status: OrderStatus, note?: string) => Promise<void>;
  deleteOrderAction: (id: string) => Promise<void>;
};

export default function OrderActions({
  orderId,
  currentStatus,
  isAdmin,
  updateStatus,
  deleteOrderAction,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const availableStatuses = Object.keys(ORDER_STATUS_LABELS).filter(
    (s) => s !== currentStatus
  ) as OrderStatus[];

  const handleStatusChange = async (status: OrderStatus) => {
    setLoading(status);
    try {
      await updateStatus(orderId, status);
      toast.success(`Статус изменен: ${ORDER_STATUS_LABELS[status]}`);
      router.refresh();
    } catch {
      toast.error("Ошибка при смене статуса");
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    setLoading("delete");
    try {
      await deleteOrderAction(orderId);
      toast.success("Заказ удален");
      router.push("/orders");
    } catch {
      toast.error("Ошибка при удалении");
    } finally {
      setLoading(null);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="actions">
      <div className="dropdown-wrap">
        <button type="button" className="btn-secondary btn-with-icon" disabled={!!loading}>
          {loading && loading !== "delete" ? (
            <Loader2 size={14} className="spin" />
          ) : (
            <ChevronDown size={14} />
          )}
          Сменить статус
        </button>
        <div className="dropdown">
          {availableStatuses.map((status) => (
            <button
              type="button"
              key={status}
              className="dropdown-item"
              onClick={() => handleStatusChange(status)}
              disabled={!!loading}
            >
              <OrderStatusDot status={status} />
              {ORDER_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {isAdmin && !showDeleteConfirm && (
        <button
          type="button"
          className="btn-danger-outline"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 size={14} />
          Удалить
        </button>
      )}

      {showDeleteConfirm && (
        <div className="confirm-wrap">
          <span className="confirm-text">Удалить заказ?</span>
          <button
            type="button"
            className="btn-danger"
            onClick={handleDelete}
            disabled={loading === "delete"}
          >
            {loading === "delete" ? <Loader2 size={13} className="spin" /> : null}
            Да, удалить
          </button>
          <button
            type="button"
            className="btn-ghost-small"
            onClick={() => setShowDeleteConfirm(false)}
          >
            Отмена
          </button>
        </div>
      )}

      <style>{`
        .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

        .dropdown-wrap { position: relative; }
        .dropdown-wrap:hover .dropdown { display: flex; }

        .dropdown {
          display: none;
          flex-direction: column;
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          background: var(--color-surface);
          backdrop-filter: blur(16px);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-dropdown);
          min-width: 180px;
          z-index: 50;
          padding: 4px;
          overflow: hidden;
        }

        .dropdown-item {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 12px; width: 100%;
          background: none; border: none; border-radius: var(--radius-sm);
          font-size: 13px; color: var(--color-text); cursor: pointer;
          font-family: var(--font-sans); text-align: left;
          transition: background 0.12s;
        }

        .dropdown-item:hover { background: var(--color-muted-bg); }
        .dropdown-item:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-secondary, .btn-with-icon {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 14px; background: var(--color-surface);
          border: 1px solid var(--color-border); border-radius: var(--radius-sm);
          font-size: 13px; font-weight: 500; color: var(--color-text);
          cursor: pointer; font-family: var(--font-sans);
          transition: background 0.15s;
        }
        .btn-secondary:hover { background: var(--color-muted-bg); }
        .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-danger-outline {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 14px; background: transparent;
          border: 1px solid var(--color-border); border-radius: var(--radius-sm);
          font-size: 13px; font-weight: 500; color: var(--color-muted);
          cursor: pointer; font-family: var(--font-sans);
          transition: all 0.15s;
        }
        .btn-danger-outline:hover {
          color: var(--color-danger); border-color: var(--color-danger);
          background: var(--color-danger-bg);
        }

        .confirm-wrap {
          display: flex; align-items: center; gap: 8px;
          background: var(--color-danger-bg); border: 1px solid var(--color-danger);
          border-radius: var(--radius-sm); padding: 8px 12px;
        }

        .confirm-text { font-size: 13px; color: var(--color-danger); font-weight: 500; }

        .btn-danger {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px; background: var(--color-danger);
          border: none; border-radius: var(--radius-sm);
          font-size: 12px; font-weight: 500; color: white;
          cursor: pointer; font-family: var(--font-sans);
        }
        .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-ghost-small {
          padding: 6px 10px; background: none; border: none;
          font-size: 12px; color: var(--color-muted); cursor: pointer;
          font-family: var(--font-sans);
          transition: color 0.15s;
        }
        .btn-ghost-small:hover { color: var(--color-text); }

        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
