import type { OrderStatus, ParcelStatus, ParcelTaskStatus } from "@prisma/client";

/** RU-названия статусов Заказа. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Новый",
  IN_RECEIVING_QUEUE: "В очереди на приём",
  RECEIVED: "Принят на склад",
  RECEIVED_WITH_DISCREPANCY: "Принят с несоответствием",
  FORMED: "Оформлен на отправку",
  RETURNED: "Возвращён",
  UTILIZED: "Утилизировано",
};

/** RU-названия статусов Посылки. */
export const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  FORMED: "Новая",
  ASSEMBLED: "Собран",
  PACKED: "Упакован",
  READY_TO_SHIP: "Готова к отправке",
  SHIPPED: "Отправлена",
  DELIVERED: "Доставлена",
  RETURNED: "Возвращён",
  UTILIZED: "Утилизировано",
};

/** RU-названия статусов Задачи на формирование посылки. */
export const TASK_STATUS_LABELS: Record<ParcelTaskStatus, string> = {
  NEW: "Создана",
  IN_PROGRESS: "В работе",
  ASSEMBLED: "Собрана",
  PACKED: "Упакована",
  WEIGHED: "Взвешена",
  COMPLETED: "Посылка сформирована",
  CANCELED: "Отменена",
};

/**
 * RU-названия видов доставки (fallback для синхронного отображения).
 * Источник правды — справочник DeliveryMethod в БД; здесь статичная копия
 * актуальных кодов, т.к. виды меняются крайне редко.
 */
export const DELIVERY_TYPE_LABELS: Record<string, string> = {
  AIR: "Авиа",
  SEA: "Море",
  TRAIN: "Ж/Д",
  TRUCK: "Авто",
};

/** Цвет статуса Заказа (для бейджей admin). */
export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  NEW: "new",
  IN_RECEIVING_QUEUE: "processing",
  RECEIVED: "shipped",
  RECEIVED_WITH_DISCREPANCY: "canceled",
  FORMED: "completed",
  RETURNED: "canceled",
  UTILIZED: "canceled",
};

/**
 * Цвет статуса Посылки (для бейджей admin).
 * 8 статусов раскладываются на палитру статусов: 5 общих ключей
 * (new/processing/shipped/completed/canceled) + 3 специальных для посылок
 * (assembled/ready/utilized), чтобы соседние этапы визуально не сливались.
 */
export const PARCEL_STATUS_COLOR: Record<ParcelStatus, string> = {
  FORMED: "new", // Новая — синий
  ASSEMBLED: "assembled", // Собран — бирюзовый
  PACKED: "processing", // Упакован — янтарный
  READY_TO_SHIP: "ready", // Готова к отправке — индиго
  SHIPPED: "shipped", // Отправлена — фиолетовый
  DELIVERED: "completed", // Доставлена — зелёный
  RETURNED: "canceled", // Возвращён — красный
  UTILIZED: "utilized", // Утилизировано — серый
};

/** Цвет статуса Задачи (для бейджей admin): те же ключи, что у посылки. */
export const TASK_STATUS_COLOR: Record<ParcelTaskStatus, string> = {
  NEW: "new",
  IN_PROGRESS: "processing",
  ASSEMBLED: "assembled",
  PACKED: "processing",
  WEIGHED: "ready",
  COMPLETED: "completed",
  CANCELED: "canceled",
};

export function orderStatusLabel(s: OrderStatus): string {
  return ORDER_STATUS_LABELS[s] ?? s;
}
export function parcelStatusLabel(s: ParcelStatus): string {
  return PARCEL_STATUS_LABELS[s] ?? s;
}
export function taskStatusLabel(s: ParcelTaskStatus): string {
  return TASK_STATUS_LABELS[s] ?? s;
}
export function deliveryTypeLabel(d: string | null | undefined): string {
  return d ? DELIVERY_TYPE_LABELS[d] ?? d : "—";
}
