/**
 * Расчёт стоимости посылки (квитанция) для схемы v2.
 * Чистая функция — без обращения к БД, легко тестируется.
 * Соответствует структуре квитанции OS4057PL: строки услуг в $ и ¥ + итог.
 */

export type CalcOrderLine = {
  quantity: number;
  declaredValueUsd: number; // объявленная стоимость строки (для страховки)
  detailedCheckRequested: boolean; // выбрана «Детальная проверка и фотоотчёт»
};

export type CalcServiceFlags = {
  consolidation?: boolean; // Консолидация 0.3 $/кг
  compactPack?: boolean; // Компактная упаковка 0.5 $/кг
  standardCheck?: boolean; // Стандартная проверка 1.0 $/кг
  reinforcedPackUsd?: number; // Усиленная упаковка — по факту ($)
  localDeliveryUsd?: number; // Доставка до склада — сумма из регистра ($)
  insurancePercent?: number; // Страховка 2–10 % (вручную)
};

export type CalcInput = {
  billableWeightKg: number; // расчётный вес
  pricePerKgUsd: number; // ставка тарифа $/кг
  handlingFeeUsd: number; // оформление $
  exchangeRateCnyPerUsd: number; // курс
  discountPercent?: number; // скидка % от итога
  orders: CalcOrderLine[];
  services: CalcServiceFlags;
};

export type CalcLine = { code: string; name: string; priceUsd: number };

export type CalcResult = {
  lines: CalcLine[]; // строки квитанции (без курса)
  subtotalUsd: number; // до скидки
  discountUsd: number;
  totalUsd: number;
  totalCny: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcParcel(input: CalcInput): CalcResult {
  const {
    billableWeightKg, pricePerKgUsd, handlingFeeUsd, exchangeRateCnyPerUsd,
    discountPercent = 0, orders, services,
  } = input;

  const lines: CalcLine[] = [];

  // Отправка = вес × ставка
  lines.push({ code: "SHIPPING", name: "Отправка", priceUsd: round2(billableWeightKg * pricePerKgUsd) });
  // Оформление
  if (handlingFeeUsd > 0) lines.push({ code: "HANDLING", name: "Оформление", priceUsd: round2(handlingFeeUsd) });

  // Услуги «за кг» (от веса всей посылки)
  if (services.consolidation) lines.push({ code: "CONSOLIDATION", name: "Консолидация", priceUsd: round2(billableWeightKg * 0.3) });
  if (services.compactPack) lines.push({ code: "COMPACT_PACK", name: "Компактная упаковка", priceUsd: round2(billableWeightKg * 0.5) });
  if (services.standardCheck) lines.push({ code: "STANDARD_CHECK", name: "Стандартная проверка на соответствие", priceUsd: round2(billableWeightKg * 1.0) });

  // Детальная проверка — 2$ за каждую строку-заказ с флагом
  const detailedCount = orders.filter((o) => o.detailedCheckRequested).length;
  if (detailedCount > 0) lines.push({ code: "DETAILED_CHECK", name: "Детальная проверка и фотоотчёт", priceUsd: round2(detailedCount * 2.0) });

  // Усиленная упаковка / Доставка до склада — по факту
  if (services.reinforcedPackUsd) lines.push({ code: "REINFORCED_PACK", name: "Усиленная упаковка", priceUsd: round2(services.reinforcedPackUsd) });
  if (services.localDeliveryUsd) lines.push({ code: "LOCAL_DELIVERY", name: "Доставка до склада", priceUsd: round2(services.localDeliveryUsd) });

  // Страховка — % от суммы объявленных стоимостей
  if (services.insurancePercent && services.insurancePercent > 0) {
    const declaredTotal = orders.reduce((s, o) => s + (o.declaredValueUsd || 0), 0);
    lines.push({ code: "INSURANCE", name: "Дополнительная страховка", priceUsd: round2(declaredTotal * (services.insurancePercent / 100)) });
  }

  const subtotalUsd = round2(lines.reduce((s, l) => s + l.priceUsd, 0));
  const discountUsd = round2(subtotalUsd * (discountPercent / 100));
  const totalUsd = round2(subtotalUsd - discountUsd);
  const totalCny = round2(totalUsd * exchangeRateCnyPerUsd);

  return { lines, subtotalUsd, discountUsd, totalUsd, totalCny };
}
