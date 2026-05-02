# PostmanFox Admin

Операционная админка для отправлений PostmanFox: клиенты, отправления, услуги, статусы, тарифные справочники и базовая аналитика.

## Стек

- Next.js App Router
- React 19
- Auth.js / NextAuth
- Prisma ORM
- SQLite для локальной разработки

## Быстрый старт

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env` на основе `.env.example`.

3. Подготовить Prisma Client и локальную базу:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

4. Запустить проект:

```bash
npm run dev -- --port 3000
```

5. Проверить сборку:

```bash
npm run lint
npm run build
```

## Полезные команды

```bash
npm run db:studio
npm run db:deploy
```

## Локальные данные

- Основная база разработки: `data/admin-panel.db`
- Загруженные изображения по умолчанию: `public/uploads`
- Временные папки `.next`, `.tools`, `.recovery`, `Downloads` и локальные логи не предназначены для релиза.

## Тарифы

Справочник тарифов добавлен в `lib/postmanfox-tariffs.ts` и отображается в разделе `/tariffs`. Источник: https://postmanfox.com/ru/tarify/
