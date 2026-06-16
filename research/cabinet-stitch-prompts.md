# Stitch-промпты: клиентский кабинет PostmanFox

Источник задачи: новый стиль, premium, mobile-first, scope «сразу оформить заказ».
Вход: Telegram Login + fallback по КОД_КЛИЕНТА. UI язык — русский.
Инструмент: Google Stitch (stitch.withgoogle.com). Генерировать по одному экрану.

---

## Дизайн-направление (выбрано)

**«Modern logistics premium» — dark-first, depth & glass, expressive type.**

Тренды 2026, заложенные в стиль:
- **Dark-first** с тёплой базой (не чёрный, а глубокий тёплый графит), светлая тема — вторична.
- **Бренд-акцент PostmanFox сохранён**: тёплый оранжевый, но поданный как сочный градиент-меш, а не плоская заливка.
- **Spatial depth**: frosted glass карточки, мягкие тени, слои.
- **Большие радиусы** 20–28px, bento-раскладка на обзоре.
- **Выразительная типографика**: variable-шрифт (Geist / Clash Display для заголовков), крупные числа.
- **Micro-interactions**: статус-таймлайны, плавные появления.
- **Mobile-first**, ширина 390px база, затем адаптив.

### Палитра (для вставки в Stitch при необходимости)
- Фон: deep warm graphite `#161311`
- Поверхность (glass): `rgba(38,32,28,0.72)` + blur
- Текст: `#F5F0EA`
- Акцент: оранжевый `#E0702F` → градиент к `#F2A65A`
- Успех/доставлено: `#4FB286`
- В пути: violet `#8B7BE8`
- К оплате/предупреждение: amber `#F0B429`
- Mono (трек/код): JetBrains Mono

---

## 0. Глобальный стиль (префикс — задать один раз в настройках/первом промпте)

```
Design a premium mobile-first client portal for an international parcel-delivery
company (PostmanFox). Audience: regular customers checking parcel status and
placing orders, mostly on phones. Visual style: dark-first, warm deep graphite
background (#161311), frosted-glass cards with soft depth and large 24px radii,
a warm orange brand accent (#E0702F) used as a subtle mesh gradient, expressive
modern variable typography (large bold headings, tabular numbers), generous
spacing, calm micro-shadows. Friendly, trustworthy, high-end fintech feel — not
a dense admin dashboard. UI language: Russian. Use Cyrillic labels exactly as
given. Include a bottom tab bar on mobile.
```

---

## 1. Экран входа (Login)

```
Screen: Client login. Centered glass card on a dark warm-graphite background with
a soft orange mesh-gradient glow behind it. PostmanFox fox logo at top.
Heading "Вход в кабинет". Primary big button "Войти через Telegram" with the
Telegram icon (blue). Below a subtle divider "или". Secondary input field labeled
"КОД КЛИЕНТА" (monospace) with a button "Войти по коду". Small helper text:
"Нет аккаунта? Обратитесь к вашему менеджеру". Bottom-safe area. Calm, premium,
minimal. Mobile 390px.
```

## 2. Обзор (Overview / Dashboard) — bento

```
Screen: Customer home/overview. Top: greeting "Здравствуйте, <Имя>" and the
client code as a small mono chip. Bento grid of glass cards: (1) large hero card
"Активные посылки" showing a number and a mini horizontal status timeline;
(2) card "К оплате" with a big amber amount in CNY (¥); (3) card "В пути" count;
(4) wide card "Последняя посылка" with track number (mono), status pill, and an
arrow. Floating primary action button "+ Оформить заказ" (orange gradient).
Bottom tab bar: Обзор, Посылки, Заказы, Профиль. Dark, depth, large radii,
mobile-first.
```

## 3. Мои посылки (Parcels) — статус-таймлайн

```
Screen: "Мои посылки". List of glass parcel cards. Each card: track number (mono)
top-left, status pill top-right (Новая / В обработке / Отправлена / Доставлена with
distinct colors), a horizontal step timeline of 4 statuses with the current step
highlighted in orange, amount to pay in ¥, and date. Sticky search field on top
"Поиск по треку". Filter chips: Все, В пути, Доставлены, К оплате. Bottom tab bar.
Premium dark style, mobile-first.
```

## 4. Оформить заказ (Create order) — ключевой экран

```
Screen: "Оформить заказ" — a clean multi-step form on dark glass. Step indicator
(1 Получатель · 2 Товары · 3 Подтверждение). Step shown: adding items. Field
"Трек-номер" (monospace input with a paste icon), field "Наименование товара" with
autocomplete suggestions chips, "Количество" stepper, "Стоимость, $" numeric.
A list of already-added items as compact rows with thumbnails and a delete icon.
Recipient selector at top: a dropdown "Получатель" showing name + address from an
address book, with "+ Новый получатель". Sticky bottom bar: total items count and
a primary orange button "Далее". Mobile-first, premium, friendly.
```

## 5. Профиль и адресная книга (Profile)

```
Screen: "Профиль". Top: avatar with client initials, name, client code mono chip,
Telegram @username with a connected badge. Glass card "Данные клиента": email,
телефон, страна/город as clean label-value rows. Section "Получатели" (address
book): list of recipient cards with name, city, address, phone and an edit icon;
a "+ Добавить получателя" button. Settings rows: "Тема", "Уведомления в Telegram"
(toggle on), "Выйти". Bottom tab bar. Dark premium, large radii, mobile-first.
```

---

## После генерации
1. Пользователь запускает каждый промпт в Stitch, смотрит варианты.
2. Понравившиеся экраны экспортируются → собираем на shadcn/ui + Tailwind v4 (skill `vercel:shadcn`).
3. Параллельно `auth-engineer` поднимает Telegram-вход; `client-cabinet-designer` сводит токены нового стиля.
