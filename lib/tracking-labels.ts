// Названия статусов отслеживания 17TRACK для людей. Общий модуль для сервера и браузера.

const STATUS: Record<string, string> = {
  NotFound: "Нет данных",
  InfoReceived: "Данные переданы перевозчику",
  InTransit: "В пути",
  Expired: "Давно нет новостей",
  AvailableForPickup: "Ждёт в пункте выдачи",
  OutForDelivery: "Передана курьеру",
  DeliveryFailure: "Не удалось вручить",
  Delivered: "Доставлена",
  Exception: "Проблема",
};

const SUB_STATUS: Record<string, string> = {
  NotFound_InvalidCode: "Номер не распознан",
  InTransit_PickedUp: "Принята перевозчиком",
  InTransit_Departure: "Отправлена из пункта",
  InTransit_Arrival: "Прибыла в пункт",
  InTransit_CustomsProcessing: "На таможне",
  InTransit_CustomsReleased: "Выпущена таможней",
  InTransit_CustomsRequiringInformation: "Таможня запросила данные",
  DeliveryFailure_NoBody: "Не удалось вручить: никого нет",
  DeliveryFailure_Security: "Не удалось вручить: проверка безопасности",
  DeliveryFailure_Rejected: "Не удалось вручить: отказ",
  DeliveryFailure_InvalidAddress: "Не удалось вручить: неверный адрес",
  Exception_Returning: "Возвращается отправителю",
  Exception_Returned: "Возвращена отправителю",
  Exception_NoBody: "Проблема: получателя нет",
  Exception_Security: "Проблема: проверка безопасности",
  Exception_Damage: "Повреждена",
  Exception_Rejected: "Отказ получателя",
  Exception_Delayed: "Задерживается",
  Exception_Lost: "Потеряна",
  Exception_Destroyed: "Уничтожена",
  Exception_Cancel: "Отменена",
};

/** Статус отслеживания одной строкой: уточнение, если оно есть, иначе основной статус. */
export function trackingStatusLabel(status: string | null | undefined, subStatus?: string | null): string {
  if (subStatus && SUB_STATUS[subStatus]) return SUB_STATUS[subStatus];
  if (!status) return "Не отслеживается";
  return STATUS[status] ?? status;
}

/** Ссылка на страницу номера в 17TRACK. */
export function trackingUrl(number: string): string {
  return `https://t.17track.net/ru#nums=${encodeURIComponent(number)}`;
}
