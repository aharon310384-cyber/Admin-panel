# PostmanFox Admin

Операционная админка для отправлений PostmanFox: клиенты, отправления, услуги, статусы, тарифные справочники и базовая аналитика.

## Стек

- Next.js App Router
- React 19
- Auth.js / NextAuth
- Prisma ORM
- PostgreSQL 16

## Быстрый старт

1. Установить зависимости:

```bash
npm install
```

2. Установить PostgreSQL (Linux: `apt install postgresql`, Windows: установщик с postgresql.org) и создать базу:

```bash
sudo -u postgres psql -c "CREATE ROLE postmanfox LOGIN PASSWORD 'postmanfox'" -c "CREATE DATABASE postmanfox OWNER postmanfox ENCODING 'UTF8' TEMPLATE template0"
```

3. Создать `.env` на основе `.env.example`.

4. Подготовить Prisma Client и базу:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

5. Запустить проект:

```bash
npm run dev -- --port 3000
```

6. Проверить сборку:

```bash
npm run lint
npm run build
```

## Полезные команды

```bash
npm run db:studio
npm run db:deploy
```

## Компании и бренды

Название, логотип, сайт и тексты Telegram хранятся в базе, а не в коде: «Администрирование → Компании», инструкция — `docs/product/инструкция-компании.md`. Начальные данные (ShuTai — бренд админки, PostmanFox — бренд кабинета и Telegram) создаёт `npm run db:upgrade:companies`; при деплое он запускается сам в составе `db:upgrade`. Повторный запуск ничего не меняет.

## Обновление базы под документооборот

Один раз для базы, созданной до появления документооборота (сначала — резервная копия базы):

```bash
npm run db:push
npm run db:upgrade:document-flow
```

Заказы получают номера `ZK-…`, прежние номера посылок становятся номерами задач, посылки — `PS-…`. Повторный запуск ничего не меняет. Подробности — `docs/product/документооборот.md`.

## База данных

PostgreSQL, адрес — `DATABASE_URL` в `.env`. До 2026-10 база была SQLite (`data/postmanfox.db`). Рабочий сервер переводится командой `postgres` задачи «Сервер», перенос данных — `prisma/sqlite-to-postgres.ts`, см. `docs/deploy/автодеплой.md`.

## Локальные данные

- Загруженные изображения по умолчанию: `public/uploads`
- Временные папки `.next`, `.tools`, `.recovery`, `Downloads` и локальные логи не предназначены для релиза.

## Тарифы

Тарифы доставки и цены услуг хранятся в базе (`ShippingTariff`, `ServiceTariff`) и правятся в «Логистика → Тарифы» (`/tariffs`), инструкция — `docs/product/инструкция-тарифы.md`. Тариф посылки выбирается по стране получателя и виду доставки. Начальные данные создаёт `npm run db:upgrade:tariffs` (при деплое — сам, в составе `db:upgrade`).
