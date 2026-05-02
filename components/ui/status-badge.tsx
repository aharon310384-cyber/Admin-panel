import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/types";
import { cn } from "@/lib/utils";

type OrderStatusProps = {
  status: OrderStatus;
  className?: string;
};

export function OrderStatusBadge({ status, className }: OrderStatusProps) {
  const tone = ORDER_STATUS_TONE[status];

  return (
    <span className={cn("status-badge", `status-badge--${tone}`, className)}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export function OrderStatusDot({ status, className }: OrderStatusProps) {
  const tone = ORDER_STATUS_TONE[status];

  return <span className={cn("status-dot", `status-dot--${tone}`, className)} />;
}

export function ProductStatusBadge({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "product-status-badge",
        active ? "product-status-badge--active" : "product-status-badge--archived",
        className
      )}
    >
      {active ? "Активна" : "Архив"}
    </span>
  );
}
