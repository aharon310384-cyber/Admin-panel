import type { ParcelStatus } from "@prisma/client";

type Meta = { label: string; color: string };

const STATUS_META: Record<ParcelStatus, Meta> = {
  FORMED: { label: "Новая", color: "var(--cab-blue)" },
  ASSEMBLED: { label: "Собрана", color: "var(--cab-orange)" },
  PACKED: { label: "Упакована", color: "var(--cab-orange)" },
  READY_TO_SHIP: { label: "Готова к отправке", color: "var(--cab-mint)" },
  SHIPPED: { label: "Отправлена", color: "var(--cab-mint)" },
  DELIVERED: { label: "Доставлена", color: "var(--cab-green)" },
  RETURNED: { label: "Возврат", color: "var(--cab-muted)" },
  UTILIZED: { label: "Утилизирована", color: "var(--cab-danger)" },
};

export function statusLabel(status: ParcelStatus): string {
  return STATUS_META[status].label;
}

export default function StatusPill({ status }: { status: ParcelStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="cab-status-pill"
      style={{ ["--pill" as string]: meta.color }}
    >
      <span className="cab-status-dot" />
      {meta.label}
      <style>{`
        .cab-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px 4px 8px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 600;
          white-space: nowrap;
          color: color-mix(in srgb, var(--pill) 72%, var(--cab-text));
          background: color-mix(in srgb, var(--pill) 14%, transparent);
          border: 1px solid color-mix(in srgb, var(--pill) 26%, transparent);
        }
        .cab-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--pill);
        }
      `}</style>
    </span>
  );
}
