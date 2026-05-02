import type { OrderStatus, UserRole } from "@prisma/client";

export type { OrderStatus, UserRole };

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Ожидает оплаты",
  PROCESSING: "На складе",
  SHIPPED: "Отправлено",
  COMPLETED: "Доставлено",
  CANCELED: "Отменено",
  PAID: "Оплачен",
  RETURNED_PAID: "Возврат оплачен",
  RETURNED_UNPAID: "Возврат не оплачен",
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "NEW",
  "PROCESSING",
  "PAID",
  "SHIPPED",
  "COMPLETED",
  "RETURNED_PAID",
  "RETURNED_UNPAID",
];

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
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
