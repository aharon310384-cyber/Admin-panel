import type { ParcelStatus, UserRole } from "@prisma/client";

export type { ParcelStatus, UserRole };

export const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  NEW: "Ожидает оплаты",
  PROCESSING: "На складе",
  SHIPPED: "Отправлено",
  COMPLETED: "Доставлено",
  CANCELED: "Отменено",
  PAID: "Оплачен",
  RETURNED_PAID: "Возврат оплачен",
  RETURNED_UNPAID: "Возврат не оплачен",
};

export const PARCEL_STATUS_FLOW: ParcelStatus[] = [
  "NEW",
  "PROCESSING",
  "PAID",
  "SHIPPED",
  "COMPLETED",
  "RETURNED_PAID",
  "RETURNED_UNPAID",
];

export const PARCEL_STATUS_TONE: Record<ParcelStatus, string> = {
  NEW: "new",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  COMPLETED: "completed",
  CANCELED: "canceled",
  PAID: "completed",
  RETURNED_PAID: "returned-paid",
  RETURNED_UNPAID: "returned-unpaid",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
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
