import type { OrderStatus, ParcelStatus, ParcelTaskStatus, PurchaseLineKind, PurchaseLineStatus, PurchaseMode, PurchaseReturnKind, PurchaseStatus, TopUpRequestStatus } from "@prisma/client";

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

/** RU-названия статусов Покупки (docs/product/задание-выкуп.md, раздел 4). */
export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  NEW: "Новая",
  PRICED: "Цена назначена",
  PAID: "Оплачена",
  PURCHASED: "Выкуплена",
  AT_WAREHOUSE: "На складе",
  SHIPPED: "Отправлена",
  REJECTED: "Отказ",
  CANCELED: "Отменена",
  RETURNED: "Возврат",
};

/** Что происходит с покупкой — для клиента (кабинет, «Мои покупки»). */
export const PURCHASE_STATUS_HINTS: Record<PurchaseStatus, string> = {
  NEW: "Менеджер проверяет товары и считает цену",
  PRICED: "Цена готова — ждём оплату",
  PAID: "Покупаем у продавцов",
  PURCHASED: "Всё выкуплено — ждём, когда продавцы отправят на склад",
  AT_WAREHOUSE: "Все товары на складе",
  SHIPPED: "Посылка оформлена — дальше в «Посылках»",
  REJECTED: "Покупка невозможна",
  CANCELED: "Вы отменили покупку",
  RETURNED: "Товары возвращены продавцам",
};

export const PURCHASE_LINE_STATUS_LABELS: Record<PurchaseLineStatus, string> = {
  WAITING: "Ждёт покупки",
  PURCHASED: "Выкуплена",
  SHIPPED: "Отправлена продавцом",
  AT_WAREHOUSE: "На складе",
  REJECTED: "Отказ",
  RETURNED: "Возврат",
};

export const PURCHASE_MODE_LABELS: Record<PurchaseMode, string> = {
  TURNKEY: "Под ключ",
  BUYOUT_ONLY: "Только выкуп",
};

export const PURCHASE_LINE_KIND_LABELS: Record<PurchaseLineKind, string> = {
  LINK: "По ссылке",
  CONTACT: "По контакту",
};

export const PURCHASE_RETURN_KIND_LABELS: Record<PurchaseReturnKind, string> = {
  SELLER: "Брак или не тот товар — за счёт продавца",
  CLIENT: "Клиент передумал — за счёт клиента",
};

/** RU-названия статусов Заявки на пополнение баланса. */
export const TOP_UP_STATUS_LABELS: Record<TopUpRequestStatus, string> = {
  PENDING: "Ждёт проверки",
  PAID: "Зачислена",
  CANCELED: "Отклонена",
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

/** Цвет статуса Покупки (для бейджей admin): те же ключи, что у посылки. */
export const PURCHASE_STATUS_COLOR: Record<PurchaseStatus, string> = {
  NEW: "new",
  PRICED: "processing",
  PAID: "assembled",
  PURCHASED: "ready",
  AT_WAREHOUSE: "shipped",
  SHIPPED: "completed",
  REJECTED: "canceled",
  CANCELED: "utilized",
  RETURNED: "canceled",
};

export const PURCHASE_LINE_STATUS_COLOR: Record<PurchaseLineStatus, string> = {
  WAITING: "processing",
  PURCHASED: "ready",
  SHIPPED: "shipped",
  AT_WAREHOUSE: "completed",
  REJECTED: "canceled",
  RETURNED: "utilized",
};

export const TOP_UP_STATUS_COLOR: Record<TopUpRequestStatus, string> = {
  PENDING: "processing",
  PAID: "completed",
  CANCELED: "canceled",
};

export function purchaseStatusLabel(s: PurchaseStatus): string {
  return PURCHASE_STATUS_LABELS[s] ?? s;
}

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
