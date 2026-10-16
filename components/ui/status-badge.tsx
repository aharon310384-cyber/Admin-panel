import type { ParcelStatus } from "@prisma/client";
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_TONE } from "@/types";
import { cn } from "@/lib/utils";

type ParcelStatusProps = {
  status: ParcelStatus;
  className?: string;
};

export function ParcelStatusBadge({ status, className }: ParcelStatusProps) {
  const tone = PARCEL_STATUS_TONE[status];

  return (
    <span className={cn("status-badge", `status-badge--${tone}`, className)}>
      {PARCEL_STATUS_LABELS[status]}
    </span>
  );
}

export function ParcelStatusDot({ status, className }: ParcelStatusProps) {
  const tone = PARCEL_STATUS_TONE[status];

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
