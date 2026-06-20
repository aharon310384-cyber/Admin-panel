import type { ParcelStatus, UserRole } from "@prisma/client";

export type { ParcelStatus, UserRole };

// Метки статусов посылки — единый источник в lib/statuses.ts (модель v2).
export { PARCEL_STATUS_LABELS } from "@/lib/statuses";

export const PARCEL_STATUS_FLOW: ParcelStatus[] = [
  "FORMED",
  "ASSEMBLED",
  "PACKED",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "UTILIZED",
];

export const PARCEL_STATUS_TONE: Record<ParcelStatus, string> = {
  FORMED: "new",
  ASSEMBLED: "processing",
  PACKED: "processing",
  READY_TO_SHIP: "shipped",
  SHIPPED: "shipped",
  DELIVERED: "completed",
  RETURNED: "canceled",
  UTILIZED: "canceled",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  WAREHOUSE: "Склад",
};

export type PaginationParams = {
  page: number;
  limit: number;
};

export type SortParams = {
  field: string;
  direction: "asc" | "desc";
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
