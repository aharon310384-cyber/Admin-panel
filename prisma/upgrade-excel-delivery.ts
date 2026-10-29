// Загрузка из Excel: вид доставки по тарифному плану строки (решение владельца 2026-10-29,
// docs/product/задание-тарифы-excel.md). Начальная настройка — RU → авто, UA → авиа, SEA → море, остальные коды → авиа;
// колонка «Тарифный план» — C, если она не занята другим полем. Дальше правится в «Загрузка из Excel» → «Колонки листа».
// Уже заданную настройку не трогает. Запускается при деплое (npm run db:upgrade) и вручную: npm run db:upgrade:excel-delivery.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const START = { codes: { RU: "TRUCK", UA: "AIR", SEA: "SEA" } as Record<string, string>, fallback: "AIR", column: "C" };

async function main() {
  const methods = new Set((await prisma.deliveryMethod.findMany({ select: { code: true } })).map((m) => m.code));
  const missing = [...new Set([...Object.values(START.codes), START.fallback])].filter((code) => !methods.has(code));
  if (missing.length) {
    console.warn(`Нет видов доставки ${missing.join(", ")} — вид доставки для Excel не настроен`);
    return;
  }
  const settings = await prisma.excelImportSettings.findFirst();
  const columns = (settings?.columns && typeof settings.columns === "object" && !Array.isArray(settings.columns) ? settings.columns : {}) as Record<string, string>;
  const codes = (settings?.deliveryTypes && typeof settings.deliveryTypes === "object" ? settings.deliveryTypes : {}) as Record<string, string>;
  const data: { deliveryTypes?: Record<string, string>; deliveryDefault?: string; columns?: Record<string, string> } = {};
  if (!Object.keys(codes).length && !settings?.deliveryDefault) {
    data.deliveryTypes = START.codes;
    data.deliveryDefault = START.fallback;
  }
  if (!columns.tariffPlan && !Object.values(columns).includes(START.column)) data.columns = { ...columns, tariffPlan: START.column };
  if (!Object.keys(data).length) return;
  if (settings) await prisma.excelImportSettings.update({ where: { id: settings.id }, data });
  else await prisma.excelImportSettings.create({ data });
  console.log(`Excel, вид доставки: ${data.deliveryTypes ? "коды заданы" : "коды уже были"}; ${data.columns ? `колонка тарифного плана — ${START.column}` : "колонка не менялась"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
