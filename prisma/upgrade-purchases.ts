// Покупка: настройки компании клиентов — комиссия, причины отказа, условия сервиса, «Только выкуп», способы пополнения.
// Запускается при деплое (npm run db:upgrade) и вручную: npm run db:upgrade:purchases
//
// Значения — решения владельца 2026-10-18 и 2026-11-05 (docs/product/будущее.md, разделы 3 и 8). Дальше они меняются
// только в «Покупки → Настройки покупки». Создаёт настройки, только если их ещё нет; повторный запуск ничего не меняет.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const START = {
  clientBuyoutOnly: false, // «Только выкуп» на старте клиентам не показывается — выбирает менеджер (2026-11-05)
  commissionPercent: 10, // 10% от суммы товара
  commissionMinCny: 10, // но не меньше 10 ¥
  numberPrefix: "VK",
  rejectReasons: [
    "Подозрение на подделку",
    "Товара нет в наличии",
    "Продавец не отвечает",
    "Товар запрещён к перевозке",
    "Продавец не отправляет на наш склад",
  ],
  rulesText:
    "Копии брендовых товаров не выкупаем и не отправляем. Если товар похож на подделку, откажем и вернём деньги на баланс.\n" +
    "Возврат: брак или не тот товар — за счёт продавца, возврат оформляем мы. Если вы передумали — за ваш счёт: доставка продавцу и комиссия не возвращаются.\n" +
    "Доставка за границу считается после взвешивания посылки: в заявке — ориентировочно.",
  topUpMethods: ["WeChat Pay", "Alipay", "Банковский перевод", "Карта (Visa / Mastercard)", "USDT"],
};

async function main() {
  const company = await prisma.company.findFirst({ where: { cabinetBrand: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  const companyId = company?.id ?? null;
  const existing = companyId
    ? await prisma.purchaseSettings.findUnique({ where: { companyId } })
    : await prisma.purchaseSettings.findFirst({ where: { companyId: null } });
  if (existing) return;

  // Общие настройки (созданы до того, как выбрали компанию клиентов) — переходят к ней
  const shared = companyId ? await prisma.purchaseSettings.findFirst({ where: { companyId: null } }) : null;
  if (shared) {
    await prisma.purchaseSettings.update({ where: { id: shared.id }, data: { companyId } });
    console.log(`Покупка: настройки переданы компании ${company!.name}`);
    return;
  }

  await prisma.purchaseSettings.create({ data: { companyId, ...START } });
  console.log(`Покупка: настройки${company ? ` компании ${company.name}` : ""} — комиссия ${START.commissionPercent}%, не меньше ${START.commissionMinCny} ¥`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
