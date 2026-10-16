-- «Заказ» → «Посылка» в базе, созданной до появления документооборота.
-- Таблицы переименовываются, а не пересоздаются, поэтому данные сохраняются.
-- Выполнить один раз, затем синхронизировать схему:
--   npm run db:upgrade:001
--   npm run db:push
-- На новой (пустой) базе скрипт не нужен.

BEGIN;

-- Переименование идёт первым: при повторном запуске скрипт сразу
-- остановится с ошибкой (таблица Parcel уже есть) и ничего не изменит.
ALTER TABLE "Order" RENAME TO "Parcel";
ALTER TABLE "OrderItem" RENAME TO "ParcelItem";
ALTER TABLE "ParcelItem" RENAME COLUMN "orderId" TO "parcelId";
ALTER TABLE "OrderStatusHistory" RENAME TO "ParcelStatusHistory";
ALTER TABLE "ParcelStatusHistory" RENAME COLUMN "orderId" TO "parcelId";

-- Старые индексы остались с именами Order_* и совпадут с индексами новой
-- таблицы «Order». db push создаст их заново под именами Parcel_*.
DROP INDEX IF EXISTS "Order_number_key";
DROP INDEX IF EXISTS "Order_status_idx";
DROP INDEX IF EXISTS "Order_customerId_idx";
DROP INDEX IF EXISTS "Order_createdAt_idx";
DROP INDEX IF EXISTS "Order_saleDate_idx";
DROP INDEX IF EXISTS "Order_total_idx";
DROP INDEX IF EXISTS "Order_totalUsd_idx";
DROP INDEX IF EXISTS "Order_totalCny_idx";
DROP INDEX IF EXISTS "Order_number_idx";
DROP INDEX IF EXISTS "Order_parcelNumber_idx";
DROP INDEX IF EXISTS "Order_isPaid_idx";
DROP INDEX IF EXISTS "Order_sourceSheet_sourceRow_idx";
DROP INDEX IF EXISTS "OrderItem_orderId_idx";
DROP INDEX IF EXISTS "OrderItem_productId_idx";
DROP INDEX IF EXISTS "OrderStatusHistory_orderId_idx";

COMMIT;
