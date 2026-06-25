# Архитектура системы PostmanFox CRM/ERP

Документ перевода рабочего Excel-учёта в полноценную систему управления отправками.

Дата: 2026-04-27
Статус: проектная архитектура (код не пишется, утверждаем подход)

---

## 1. Что есть сейчас (на чём стоим)

### 1.1 Бизнес — реальная картина

Это **не интернет-магазин**, как описано в `idea.md` и текущей `prisma/schema.prisma`. Это **логистический сервис международной доставки из Китая** (Гуанчжоу → Европа, СНГ, США, Канада, Узбекистан и т.д.). Контекст подтверждается:
- инвойсом OS4057PL (PostmanFox → Польша, Paczkomat InPost) — `research/postmanfox.md`
- скрином кабинета конкурента Meest China — `research/competitors-list.md`
- двумя Excel-файлами в `Downloads/` (см. ниже)

### 1.2 Excel-файлы — главный источник данных

| Файл | Размер | Листов | Что внутри |
|---|---|---|---|
| `Downloads/1. order 2023.03.06 (8).xlsx` | 5,5 МБ | **21 лист** | Главная база: лист `Clients` + годовые рабочие листы отправок |
| `Downloads/book-2.xlsx` | 1,7 МБ | 4 листа | Рабочая копия текущего периода, ссылки на главный файл через `VLOOKUP('ALL 6'!...)` |
| `Downloads/OS4057PL.jpg` | 410 КБ | — | Готовая накладная из системы (генерируется в Excel) |

### 1.3 Структура листа клиентов (`Clients`)

Колонки: `client_code`, `last_name`, `first_name`, `middle_name`, `phone`, `user_name`, `e-mail`, `country`, `city`.

- `client_code` — двухбуквенный (YN, DG, DD, MR, AT, GG, IS, AU, OL, PL, VX, SM, …) — ключ-сокращение менеджера/клиента, используется в номерах отправок.
- `user_name` — это Telegram-юзернейм (`@smechnoi`, `@qpagott`, `@Marina_Marfa`).
- В базе уже зафиксированы клиенты из 12+ стран: Germany, Russia, Ukraine, France, Canada, China, Poland, Belarus, USA, Moldova, Czech Republic, Slovenia, Uzbekistan.
- Запись `ABC / Postman / Fox / +8613640745093` — сам PostmanFox как «внутренний» контрагент.
- `MR / Срибницкая / Марина / @Marina_Marfa` — Марина-владелец (она же ведёт учёт).

### 1.4 Структура рабочего листа отправок (`ALL 6` / `Книга2`)

Колонки в реальном порядке:

| № | Поле | Назначение |
|---|---|---|
| 1 | `N` | порядковый номер строки |
| 2 | `order_number` | внутренний номер: `{2 буквы префикс}{4 цифры}{2 буквы код страны} {опц. способ}` — `AT1536DE 01 DHL`, `GG1542UA Sea`, `OS4057PL` |
| 3 | `LR` | флаг (тип/категория) |
| 4 | `Фотоотчёт не нужен` | булев флаг |
| 5 | `Info` | свободное поле: трек продавца, описание содержимого, адрес, телефон — много текста |
| 6 | `кол посылок` | число |
| 7 | `Страховка` | сумма |
| 8 | `Вес` | кг |
| 9 | `Конс-ия` | стоимость консолидации |
| 10 | `Упаковка` | стоимость упаковки |
| 11 | `Сумма в долларах` | базовый тариф $ |
| 12 | `Итого Стоимость` | итог $ |
| 13 | `Курс` | юань→доллар |
| 14 | `Лок доставка` | внутренняя доставка получателя |
| 15 | `Скидка` | сумма/процент |
| 16 | `yuan_amount` | итог в юанях |
| 17 | `Оплата` | флаг (`+` / пусто / `-`) |
| 18 | `Номер посылки` | внешний трек: `LC000…MG`, `MGRMY…YQ`, `EV…CN`, `00340…`, `JT…`, `SF…` |
| 19 | `Стоимость` | стоимость товара по декларации |
| 20 | `Выручка` | выручка PostmanFox с этой отправки |
| 21 | `sale_date` | дата отправки `2022.09.07` |
| 22 | `Получатель` | ФИО |
| 23 | `Адрес` | адрес доставки |
| 24 | `Тел номер` | телефон |
| 25 | `Сайт` | внешняя площадка покупки |
| + | HS-код / категория | для таможни (`Boots`, `Sneakers`, `Other handbags`, `Jerseys, pullovers`, `6110101000`) |

Дополнительно встречаются способы доставки в номере: `Sea`, `DHL`, `TRAIN`, `авиа` (по умолчанию).

### 1.5 Текущий код проекта — что переиспользуем, что выбрасываем

Папки и файлы:
```
app/(admin)         — каркас админки (layout, sidebar) → ПЕРЕИСПОЛЬЗУЕМ
app/login           — вход → ПЕРЕИСПОЛЬЗУЕМ
app/api/health      → ПЕРЕИСПОЛЬЗУЕМ
actions/customers.ts, orders.ts, products.ts → ПЕРЕДЕЛАТЬ под shipments/recipients/services
components/layout   → ПЕРЕИСПОЛЬЗУЕМ (с обновлением пунктов меню)
components/ui       → ПЕРЕИСПОЛЬЗУЕМ (Button, Input, Card, Modal, Status pill — универсальные)
lib/prisma.ts       → ПЕРЕИСПОЛЬЗУЕМ
lib/utils.ts        → ПЕРЕИСПОЛЬЗУЕМ
prisma/schema.prisma → ПЕРЕПИСАТЬ полностью под логистику
auth.ts, auth.config.ts, middleware.ts → ПЕРЕИСПОЛЬЗУЕМ (NextAuth настроен)
```

Все наработки по дизайн-системе из `design-requirements.md` (glassmorphism, OKLCh, Tailwind v4, shadcn/ui, Motion, TanStack Table, Recharts, Sonner, Lucide, nuqs) подходят без изменений.

---

## 2. Концепция новой системы

### 2.1 Что это будет

**PostmanFox CRM/ERP** — гибрид CRM (клиенты + коммуникации) и операционной ERP (отправки + финансы + склад + таможня), с двумя контурами:

1. **Внутренний кабинет (для Марины и менеджеров)** — заменяет Excel.
2. **Клиентский кабинет** — клиент видит свои отправки, статус, фото, оплачивает, скачивает накладную (как у Meest China).

> «Как Meest China, но под наш процесс и нашу базу клиентов».

### 2.2 Главные сущности (термины)

- **Shipment (Отправка)** — главный объект, заменяет привычный «Order». В Excel это строка рабочего листа.
- **Recipient (Получатель)** — конечный получатель посылки (ФИО, адрес, телефон). Часто совпадает с клиентом, часто нет.
- **Client (Клиент)** — заказчик отправки, тот, у кого есть кабинет. Один клиент может отправлять разным получателям.
- **Manager (Менеджер)** — сотрудник, оформивший отправку. Имеет двухбуквенный `code` (для номера отправки).
- **Country / Direction (Направление)** — страна назначения с тарифами и сроками.
- **DeliveryMethod (Способ)** — Авиа / Море / DHL / TRAIN / EMS.
- **TrackingNumber (Трек)** — может быть несколько на одну отправку (внутренний продавца + внешний почтовый).
- **ShipmentItem (Позиция)** — содержимое посылки с HS-кодом для таможни.
- **Service (Услуга)** — Консолидация / Упаковка / Проверка / Фотоотчёт / Локальная доставка / Страховка / Закупка / Доставка до склада.
- **Payment (Оплата)** — факт оплаты с привязкой к Alipay/банку.
- **StatusHistory** — лог смены статусов (кто, когда, заметка).

### 2.3 Жизненный цикл отправки (статусы)

```
DRAFT          — менеджер начал ввод в админке, не сохранил
NEW            — оформлено, ждёт оплату
PAID           — оплачено (по QR Alipay / банку)
RECEIVED       — посылка пришла на склад в Гуанчжоу
PHOTO_REPORT   — сделан фотоотчёт (если заказан)
PROCESSING     — упаковка / консолидация / маркировка
SHIPPED        — отправлено из Китая (есть внешний трек)
IN_TRANSIT     — в пути
ARRIVED        — прибыло в страну получателя
DELIVERED      — вручено
CANCELED       — отменено
RETURNED       — возврат
```

(сейчас в схеме есть `OrderStatus` с 5 значениями — расширяем до 12)

---

## 3. Схема данных (новая `prisma/schema.prisma`)

> Описание в формате таблиц для согласования. Реальный Prisma-код напишет `db-architect` после твоего одобрения.

### 3.1 Сущности

#### `User` (внутренние сотрудники)
| Поле | Тип | Назначение |
|---|---|---|
| id | cuid | PK |
| email, password, name | — | как сейчас |
| role | enum `OWNER / ADMIN / MANAGER / WAREHOUSE / ACCOUNTANT` | расширить роли |
| code | String(2) unique | двухбуквенный код для номера отправки (AT, GG, MR…) |
| telegramUsername | String? | для уведомлений в TG |
| isActive | Boolean | можно «выключить» сотрудника без удаления |

#### `Client` (внешние клиенты с кабинетом)
| Поле | Тип | Назначение |
|---|---|---|
| id | cuid | PK |
| code | String(2) unique | как `client_code` в Excel |
| firstName / lastName / middleName | — | из Excel |
| email, phone | — | unique по email |
| telegramUsername | String? | `@smechnoi` |
| countryId, city | FK / String | где живёт клиент |
| password? | для входа в личный кабинет (опционально, можно через TG-Login) |
| loyaltyTier | enum `BASIC / SILVER / GOLD / PLATINUM` | как у Meest China |
| balance | Decimal | внутренний баланс (предоплата / долг) |
| notes | Text | заметки менеджера |
| createdAt, deletedAt | — | soft delete |

#### `Recipient` (получатели — могут не быть клиентами)
| Поле | Тип |
|---|---|
| id | cuid |
| clientId? | FK Client (nullable — иногда отправка третьему лицу) |
| firstName, lastName | — |
| countryId | FK |
| addressLine, city, postalCode, region | — |
| phone, email | — |
| passportNumber? | для стран, где нужно (Узбекистан, Молдова) |
| pickupPoint? | название отделения (Нова Пошта 162, Paczkomat OLW03N) |

#### `Country`
| Поле | Тип |
|---|---|
| id | cuid |
| code | String(2) — ISO `UA`, `DE`, `PL`, `MD`, `UZ`, `RU`, `US`, `CZ`, `SL`, `BY`, `CA`, `FR` |
| nameRu, nameEn | — |
| customsLimit | Decimal — таможенный лимит |
| isActive | Boolean |

#### `DeliveryMethod`
| Поле | Тип |
|---|---|
| id | cuid |
| code | enum `AIR / SEA / DHL / TRAIN / EMS` |
| nameRu | — |

#### `Tariff` (тарифная сетка)
| Поле | Тип |
|---|---|
| id | cuid |
| countryId | FK |
| methodId | FK |
| pricePerKg | Decimal |
| minPrice | Decimal |
| daysFrom, daysTo | Int |
| validFrom, validTo | DateTime — для истории тарифов |

#### `Shipment` (главный объект)
| Поле | Тип | Из Excel |
|---|---|---|
| id | cuid | — |
| number | String unique | `order_number` (AT1536DE) |
| numberPrefix | String(2) | префикс менеджера |
| numberSerial | Int | 1536 — для авто-инкремента в рамках префикса |
| countryId | FK Country | код страны из номера (DE) |
| clientId | FK Client | от какого клиента |
| managerId | FK User | кто оформил |
| recipientId | FK Recipient | — |
| methodId | FK DeliveryMethod | Sea/DHL/AIR |
| status | enum (12 значений) | новый расширенный |
| weightKg | Decimal | `Вес` |
| parcelsCount | Int | `кол посылок` |
| insurance | Decimal | `Страховка` |
| consolidation | Decimal | `Конс-ия` |
| packaging | Decimal | `Упаковка` |
| localDelivery | Decimal | `Лок доставка` |
| photoReportRequested | Boolean | `Фотоотчёт не нужен` инвертировано |
| productCheckRequested | Boolean | проверка на брак |
| baseCostUsd | Decimal | `Сумма в долларах` |
| discount | Decimal | `Скидка` |
| totalUsd | Decimal | `Итого Стоимость` |
| yuanRate | Decimal | `Курс` |
| totalYuan | Decimal | `yuan_amount` |
| declaredValue | Decimal | `Стоимость` (товара) |
| revenue | Decimal | `Выручка` (наша маржа) |
| info | Text | `Info` (свободное поле) |
| sourceSite | String? | `Сайт` (taobao / poizon / 1688) |
| paidAt | DateTime? | `Оплата +` |
| sentAt | DateTime? | `sale_date` |
| arrivedAt | DateTime? | — |
| deliveredAt | DateTime? | — |
| createdAt, updatedAt, deletedAt | — | — |

#### `ShipmentItem` (позиции с HS-кодами для таможни)
| Поле | Тип |
|---|---|
| id | cuid |
| shipmentId | FK |
| nameRu | «куртка женская» |
| nameEn | «Jerseys, pullovers» (для декларации) |
| hsCode | String — `6110101000` |
| quantity | Int |
| priceUsd | Decimal |

#### `TrackingNumber`
| Поле | Тип |
|---|---|
| id | cuid |
| shipmentId | FK |
| number | String — внешний |
| carrier | enum `SF / JT / EMS / DHL / NOVA_POSHTA / INPOST / DEUTSCHE_POST / UKRPOSHTA / OTHER` |
| type | enum `INTERNAL_CN / INTERNATIONAL / LAST_MILE` |
| addedAt | DateTime |
| isActive | Boolean |

#### `Service` (справочник доп.услуг + цены)
| Поле | Тип |
|---|---|
| id | cuid |
| code | enum `CONSOLIDATION / PACKAGING / PHOTO / CHECK / INSURANCE / PURCHASE / WAREHOUSE_DELIVERY / LOCAL_DELIVERY` |
| nameRu | — |
| price | Decimal |
| unit | enum `PER_PARCEL / PER_ITEM / PER_KG / PERCENT` |

#### `ShipmentService` (M2M)
| Поле | Тип |
|---|---|
| shipmentId | FK |
| serviceId | FK |
| customPrice? | Decimal |
| quantity | Int |

#### `Payment`
| Поле | Тип |
|---|---|
| id | cuid |
| shipmentId | FK (или clientId для пополнения баланса) |
| amount | Decimal |
| currency | enum `USD / CNY / EUR / RUB / UAH / PLN` |
| method | enum `ALIPAY / WECHAT / BANK / CARD / BALANCE / CASH` |
| status | enum `PENDING / PAID / FAILED / REFUNDED` |
| externalRef | String? — id транзакции |
| paidAt | DateTime? |

#### `ShipmentStatusHistory` (лог)
| Поле | Тип |
|---|---|
| id, shipmentId, status, changedById (User), note, createdAt | — |

#### `WarehouseAddress`
| Поле | Тип |
|---|---|
| id | cuid |
| countryId | FK (Гуанчжоу) |
| addressLine | «Panyu District, Shi Guang Road, No. 45 Zhong Er Street, HUAJIA, корп. 4, оф. 607» |
| postalCode | 511495 |
| nameRu, nameEn, nameZh | — |
| isActive | Boolean |

#### `Notification` (для триггеров)
| Поле | Тип |
|---|---|
| id, userId/clientId, channel (`EMAIL / TELEGRAM / WHATSAPP / SMS`), event, payload, sentAt, status | — |

---

## 4. Карта страниц

### 4.1 Внутренний кабинет (`/admin`)

```
/admin                              Дашборд: метрики дня/недели/месяца
/admin/shipments                    Таблица отправок (как Excel) + URL-фильтры (nuqs)
/admin/shipments/new                Форма создания: 1-2-3 шаг (клиент → товары → услуги)
/admin/shipments/[number]           Карточка отправки (статусы, треки, фото, оплата, история)
/admin/shipments/[number]/invoice   Печатная накладная как OS4057PL.jpg
/admin/shipments/[number]/edit      Редактирование
/admin/clients                      Список клиентов
/admin/clients/[code]               Карточка клиента + все его отправки + баланс + лояльность
/admin/clients/new                  Создание
/admin/recipients                   Получатели (адресная книга)
/admin/finance                      Финансы: оплаты, выручка, должники
/admin/finance/payments             Реестр платежей
/admin/finance/debts                Долги клиентов
/admin/tariffs                      Тарифная сетка (страна × способ)
/admin/services                     Справочник услуг и цен
/admin/managers                     Сотрудники + их коды
/admin/countries                    Страны и таможенные лимиты
/admin/reports                      Отчёты: по странам, менеджерам, периодам
/admin/import                       Импорт из Excel (миграция исторических данных)
/admin/settings                     Настройки (профиль, логотип на накладной, реквизиты)
```

### 4.2 Клиентский кабинет (`/cabinet`)

Образец — Meest China (см. скрин в `research/competitor-cabinet.png`):

```
/cabinet                  Дашборд клиента: баланс, уровень лояльности, отслеживание
/cabinet/shipments        Мои посылки (список + фильтры по статусу)
/cabinet/shipments/[id]   Детали посылки + фотоотчёт + накладная PDF
/cabinet/shipments/new    Заказ новой отправки (форма: трек продавца + получатель + услуги)
/cabinet/recipients       Адресная книга (мои получатели)
/cabinet/finance          Баланс, история оплат, пополнение через Alipay
/cabinet/loyalty          Уровень и условия программы лояльности
/cabinet/calculator       Калькулятор стоимости (страна + вес → цена)
/cabinet/profile          Профиль (телефон, email, Telegram)
/cabinet/instructions     Инструкция по маркировкам (как у Meest)
/cabinet/warehouse        Адрес склада в Гуанчжоу (с QR для копирования)
```

### 4.3 Публичные страницы

```
/                  Лендинг PostmanFox
/track             Трекинг по номеру (без логина) — как trackmail
/login, /register  Авторизация
```

---

## 5. Маппинг Excel → новая БД (план миграции)

| Excel-колонка | Куда в БД |
|---|---|
| `client_code` | `Client.code` |
| `last_name / first_name / middle_name` | `Client.lastName / firstName / middleName` |
| `phone, email, user_name` | `Client.phone, email, telegramUsername` |
| `country, city` | `Client.countryId` (через справочник Country), `Client.city` |
| `order_number` | `Shipment.number` (парсится на `numberPrefix + numberSerial + countryCode`) |
| `LR` | `Shipment.legacyLR` (временно, потом разобрать) |
| `Фотоотчёт не нужен` | `Shipment.photoReportRequested = NOT(value)` |
| `Info` | `Shipment.info` |
| `кол посылок` | `Shipment.parcelsCount` |
| `Страховка / Конс-ия / Упаковка / Лок доставка` | соответствующие поля + `ShipmentService` строки |
| `Сумма в долларах / Итого Стоимость / Курс / yuan_amount / Скидка / Стоимость / Выручка` | соответствующие decimal-поля Shipment |
| `Оплата` | `Shipment.paidAt` (если `+` — текущая дата строки, иначе null) |
| `Номер посылки` | `TrackingNumber.number` (определять carrier по префиксу: SF→SF Express, JT→J&T, MGRMY→...,EV...CN→China Post...) |
| `sale_date` | `Shipment.sentAt` |
| `Получатель / Адрес / Тел номер` | новый `Recipient`, привязка к Shipment |
| `Сайт` | `Shipment.sourceSite` |
| HS-код, английская категория | `ShipmentItem.hsCode, nameEn` |
| Способ доставки в номере (`Sea / DHL / TRAIN`) | `Shipment.methodId` (парсить из `order_number`) |

### 5.1 Импортёр

Отдельная утилита (Server Action на странице `/admin/import`):
1. Загружаешь `.xlsx`.
2. Выбираешь маппинг колонок (предзаполнен по умолчанию).
3. Превью первых 50 строк.
4. Импорт с прогрессом и логом ошибок (если строка битая — в отчёт, остальные едут).
5. Идемпотентный — повторный импорт того же файла обновляет существующие отправки по `number`, не дублирует.

### 5.2 Параллельная работа в переходный период

Пока БД и Excel живут параллельно — нужен **eкспорт обратно в Excel** (для бухгалтера / привычки). Кнопка `Экспорт → XLSX` на `/admin/shipments` с теми же колонками, что в `book-2.xlsx`. Так Марина не теряет привычные отчёты.

---

## 6. Инфраструктура (с прицелом на будущее)

### 6.1 Стек (близко к тому, что уже выбран в `design-requirements.md`)

| Слой | Технология |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind v4 + shadcn/ui + Motion |
| Backend | Next.js Server Actions + Prisma 6 + Zod |
| БД (рекомендация) | **PostgreSQL 16** вместо текущего SQLite — нужны параллельные транзакции при многопользовательской работе |
| Auth | NextAuth.js v5 (Auth.js) для админки + Telegram Login Widget для клиентского кабинета |
| Файлы (фотоотчёты) | **S3-совместимое хранилище** — рекомендую Cloudflare R2 (без egress-платежей) или Backblaze B2 |
| Очереди (фоновые задачи) | BullMQ + Redis (фотоотчёты, рассылки, импорт Excel) |
| Кэш / rate-limit | Redis (Upstash в облаке) |
| Логи и ошибки | Sentry (free tier хватит) |
| Аналитика | Plausible или Umami (приватная) |
| Хостинг | **Vercel** (frontend + Server Actions) или собственный VPS с Coolify |
| БД-хостинг | Neon / Supabase (Postgres serverless) или своё |
| Мониторинг | Better Stack (Uptime + Logs) |

### 6.2 Расширения «на потом» (зарезервировано в архитектуре)

1. **Telegram-бот PostmanFox** — `@PostmanFox_bot`
   - Уведомления клиенту: «посылка пришла на склад», «отправлена», «прибыла в страну»
   - Команда `/track <номер>` — статус
   - Авторизация в кабинет через Telegram Login
   - Отдельный бот для менеджеров (быстро сменить статус кнопкой)
2. **Публичный API** для крупных клиентов
   - `POST /api/v1/shipments` — создать
   - `GET /api/v1/shipments/{number}/track` — трек
   - Авторизация по API-ключу
3. **Интеграция с трекинг-агрегаторами** — ParcelsApp, Posylka.net (получать события и автоматически менять статус)
4. **Интеграция с почтовыми сервисами** — Нова Пошта API, Укрпочта API, InPost API, DHL API — для авто-получения статусов last-mile
5. **Платежи** — webhook от Alipay / WeChat Pay для авто-простановки `paidAt`
6. **Мобильное приложение** клиента — позже, на Expo (React Native), API уже готов
7. **OCR накладных** — фото квитанции продавца → автоматически извлекать трек (через GPT-4o vision или Claude Vision)
8. **AI-ассистент** для менеджера — «найди отправки клиента DR за апрель», «сколько мы заработали в Германию в прошлом квартале»

### 6.3 Что заложить в архитектуру СРАЗУ, чтобы потом не переписывать

- **Все денежные поля** — `Decimal`, не `Float`. Уже учтено.
- **Все enum** — отдельные таблицы-справочники там, где значения могут расширяться (страны, способы, перевозчики). enum в БД оставить только там, где список фиксирован (роли, статусы).
- **Soft delete** — везде (`deletedAt`).
- **Audit log** — `ShipmentStatusHistory` уже есть, расширить до общего `AuditLog` для важных полей (изменения адреса, цены).
- **i18n-ready** — все тексты UI через `next-intl` или ключи, чтобы потом легко добавить английский / украинский кабинет.
- **Multi-tenant-ready** — поле `organizationId` зарезервировать на уровне ключевых таблиц (если потом продавать другим логистам как SaaS — переход на multi-tenant без миграций).
- **Webhooks-ready** — таблица `Webhook` (url, secret, events) — чтобы клиенты могли получать события об отправках в свой ERP.

---

## 7. Этапы реализации (укрупнённо)

| Этап | Что делается | Зачем сейчас |
|---|---|---|
| **0. Решение** | Согласовать эту архитектуру (этот файл) | Без согласия не пишем код |
| **1. БД** | Переписать `prisma/schema.prisma` под раздел 3 + миграция на PostgreSQL | Фундамент |
| **2. Auth + меню** | Обновить пункты сайдбара под новые сущности; роли OWNER/ADMIN/MANAGER/WAREHOUSE | Минимум для входа |
| **3. Импорт Excel** | Утилита загрузки `1. order 2023.03.06 (8).xlsx` и `book-2.xlsx` в БД | Чтобы Марина увидела свои данные в системе с первого дня |
| **4. Shipments CRUD** | Таблица + карточка + создание + редактирование + статусы | Главный экран — замена Excel |
| **5. Clients/Recipients** | CRUD + адресная книга + история отправок клиента | Зависимость от Shipments |
| **6. Накладная PDF** | Генерация PDF в формате `OS4057PL.jpg` | Чтобы выпускать инвойсы из системы |
| **7. Финансы** | Оплаты, баланс, должники | Заменяем колонку «Оплата» в Excel |
| **8. Тарифы и калькулятор** | Тарифная сетка + страница `/cabinet/calculator` | Ускоряет ввод и привлекает клиентов |
| **9. Клиентский кабинет** | Минимальная версия: список своих посылок + трек | Маркетинговый рывок |
| **10. Telegram-бот** | Уведомления о смене статуса | Снимает работу с менеджера |
| **11. Дашборд** | Реальная аналитика: выручка, ТОП-стран, нагрузка по менеджерам | Когда есть данные |
| **12. Интеграции** | API-ключи, webhook'и, ParcelsApp, Alipay | По мере спроса |

Каждый этап — отдельный спринт, после каждого `code-reviewer` проверяет, перед каждым `db-architect` или `tech-lead` уточняет схему.

---

## 8. Рекомендация по форме: CRM, ERP или «просто кабинет для меня»

Из вопроса «CRM или ERP или просто кабинет для меня» — мой выбор:

**Поэтапный путь: сначала «кабинет для меня» → потом CRM → потом ERP/SaaS.**

| Этап | Кому нужно | Что добавляется |
|---|---|---|
| 1. **Личный кабинет Марины** | Только владелец и менеджеры | Замена Excel — таблица отправок, клиенты, накладные |
| 2. **CRM** | + Лояльность, история коммуникаций, источник клиента | Карточка клиента с TG-перепиской, теги, заметки, сегменты |
| 3. **ERP** | + Финансы, склад, отчётность, тарифы, плановая выручка | Бухгалтерия, склад в Гуанчжоу, прогноз |
| 4. **Клиентский кабинет** | Внешние клиенты | Обычно подключают параллельно с этапом 2 |
| 5. **SaaS для других логистов** | Продаём другим компаниям | Multi-tenant, отдельные домены |

Архитектура **с самого начала** проектируется так, что этап 5 не потребует переписывания (всё ключевое заложено в разделе 6.3). На старте делаем только этап 1 (это и есть «переход с Excel»).

---

## 9. Что нужно от тебя для следующего шага

1. **Утвердить или скорректировать** структуру сущностей (раздел 3) и страниц (раздел 4) — это самое долгое потом переделывать.
2. **Подтвердить переход с SQLite на PostgreSQL** — без него многопользовательская работа будет тормозить.
3. **Решить про клиентский кабинет** — делаем сразу или откладываем? Рекомендую отложить на этап 9.
4. **Telegram-бот** — нужен ли он сразу? Или после первого этапа?
5. **Какие листы из Excel перенести в БД** — все 21 лист или только последние периоды?
6. **Имена и роли менеджеров** — нужна полная таблица `code → ФИО` (можно собрать из листа `Clients`).
7. **Новые услуги, которых нет в Excel** — например, страхование на сумму, упаковка вакуумом, ускоренная отправка — добавить?

После твоих ответов `db-architect` выпускает первую версию `prisma/schema.prisma`, `tech-lead` декомпозирует первый спринт.

---

## Приложение: первоисточники

- `Downloads/1. order 2023.03.06 (8).xlsx` — главная база (21 лист)
- `Downloads/book-2.xlsx` — рабочая копия (4 листа)
- `Downloads/OS4057PL.jpg` — накладная (формат для PDF-генератора)
- `research/competitor-cabinet.png` — скрин Meest China (референс клиентского кабинета)
- `research/postmanfox.md` — анализ сервиса PostmanFox
- `research/competitors-list.md` — 18 конкурентов
- `design-requirements.md` — дизайн-система (актуальна)
- `idea.md` — устаревшая идея «магазин» (заменяется этим документом)
