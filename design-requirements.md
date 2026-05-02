# ТРЕБОВАНИЯ К ДИЗАЙНУ И ТЕХНОЛОГИИ
## Админ-панель — Design System & Tech Stack 2026

**Дата:** 2026-04-23

---

## 1. ВИЗУАЛЬНЫЙ СТИЛЬ

### 1.1 Концепция
**Glassmorphism + Minimalism** — основной стиль интерфейса. Полупрозрачные карточки с backdrop-blur создают глубину и воздушность, минимализм снижает когнитивную нагрузку и ускоряет работу менеджеров.

Принцип: **данные — главное, интерфейс — невидим.**

### 1.2 Цветовая система (OKLCh токены)

Переход с HEX на **OKLCh** — перцептивно равномерное цветовое пространство Tailwind CSS v4.
Это означает плавные, предсказуемые градиенты и корректный контраст на всех мониторах.

```css
/* Светлая тема (по умолчанию) */
--color-bg:        oklch(96% 0.012 65);     /* тёплый бежевый фон */
--color-surface:   oklch(99% 0.008 65 / 78%); /* полупрозрачная поверхность */
--color-text:      oklch(18% 0.02 65);      /* почти чёрный тёплый */
--color-accent:    oklch(52% 0.14 42);      /* оранжевый (bb5a2c) */
--color-success:   oklch(48% 0.12 162);     /* зелёный */
--color-warning:   oklch(72% 0.16 80);      /* янтарный */
--color-danger:    oklch(52% 0.18 22);      /* красный */
--color-muted:     oklch(52% 0.02 65);      /* приглушённый текст */
--color-border:    oklch(70% 0.02 65 / 18%);/* граница */

/* Тёмная тема */
--color-bg:        oklch(14% 0.01 65);
--color-surface:   oklch(18% 0.015 65 / 82%);
--color-text:      oklch(94% 0.01 65);
--color-border:    oklch(40% 0.02 65 / 22%);
```

### 1.3 Тёмная тема
- Поддержка тёмной темы **обязательна** (в 2026 — стандарт, не опция)
- Переключение: системный `prefers-color-scheme` + ручное через кнопку
- Реализация через CSS `@layer base` + data-атрибут `data-theme="dark"`

### 1.4 Типографика

| Роль | Шрифт | Начертание |
|------|-------|-----------|
| Заголовки (h1–h3) | Space Grotesk | 600–700 |
| Текст интерфейса | Inter | 400–500 |
| Числа и данные | Inter (tabular-nums) | 500–600 |
| Код / SKU | JetBrains Mono | 400 |

Шрифты подключаются через `next/font` (self-hosted, без внешних запросов).

### 1.5 Скругления и тени

```css
/* Радиусы */
--radius-sm:  8px;    /* кнопки, badge, input */
--radius-md:  16px;   /* карточки */
--radius-lg:  24px;   /* модальные окна, панели */
--radius-xl:  32px;   /* hero-блоки */

/* Тени (glassmorphism) */
--shadow-card: 0 8px 32px oklch(18% 0.02 65 / 10%),
               0 2px 8px  oklch(18% 0.02 65 / 6%);
--shadow-modal: 0 24px 80px oklch(18% 0.02 65 / 18%);
```

### 1.6 Glassmorphism — правила применения

Применять **только к карточкам и панелям**, не ко всей странице:
- `background: var(--color-surface)` — полупрозрачный фон
- `backdrop-filter: blur(16px) saturate(1.4)`
- `border: 1px solid var(--color-border)`
- Не применять к строкам таблиц и мелким элементам

---

## 2. КОМПОНЕНТЫ ИНТЕРФЕЙСА

### 2.1 Навигация
- **Боковое меню** — фиксированное, 240px, сворачивается до 64px на планшете
- Активный пункт — акцентный цвет + левая полоска 3px
- Иконки: **Lucide React** (MIT, 1400+ иконок, SVG)
- Нижний блок: аватар + имя + роль пользователя

### 2.2 Карточки метрик
- Glassmorphism-поверхность
- Иконка + заголовок + крупное число + дельта (↑ +12%)
- Дельта: зелёный для роста, красный для падения
- Анимация появления: fade-in + slide-up (Motion, 300ms)

### 2.3 Таблицы
- Заголовки с сортировкой (↑↓ иконки)
- Чередование строк (zebra): очень слабый оттенок
- Hover состояние строки: лёгкая подсветка
- Sticky-заголовок при скролле
- Skeleton-загрузка вместо спиннера

### 2.4 Формы и инпуты
- Floating label (анимированный placeholder → label)
- Focus ring: `outline: 2px solid var(--color-accent)`
- Ошибки — под полем, красным, с иконкой
- Disabled — opacity 0.5, cursor not-allowed

### 2.5 Кнопки

| Тип | Применение |
|-----|-----------|
| Primary (заливка) | Главное действие на странице |
| Secondary (обводка) | Второстепенное действие |
| Ghost (прозрачная) | Действия в таблицах |
| Danger (красная) | Удаление |

Все кнопки имеют состояния: default, hover, active, disabled, loading.

### 2.6 Статусные метки (Status Pills)

```
NEW         — синий
PROCESSING  — янтарный
SHIPPED     — фиолетовый
COMPLETED   — зелёный
CANCELED    — красный/серый
```

Каждая метка: цветная точка + текст, border-radius полный.

### 2.7 Toast-уведомления
- Позиция: правый нижний угол
- Анимация: slide-in справа
- Автоскрытие: 4 секунды
- Типы: success, error, warning, info

### 2.8 Модальные окна
- Backdrop: `oklch(0% 0 0 / 40%)` с blur(4px) на фоне
- Анимация: scale(0.95)→scale(1) + fade-in, 200ms
- Закрытие: крестик, клавиша Escape, клик по backdrop
- Обязательное подтверждение для деструктивных действий

---

## 3. ПЕРЕДОВЫЕ ТЕХНОЛОГИИ 2026

### 3.1 UI-фреймворк — shadcn/ui + Tailwind CSS v4

**shadcn/ui** — лидер рынка в 2026. Не библиотека зависимостей, а коллекция копируемых компонентов на Radix UI. Полный контроль над кодом.

**Tailwind CSS v4** — революционные изменения:
- OKLCh цветовые токены (перцептивно равномерные)
- CSS-first конфигурация (нет `tailwind.config.js`)
- Нативный `@layer`, `@theme`, `@variant`
- Новый движок Oxide — в 5× быстрее сборка

```bash
npm install tailwindcss@4 @tailwindcss/vite
npx shadcn@latest init
```

### 3.2 Анимации — Motion (Framer Motion 12)

**Motion** (ранее Framer Motion) — стандарт анимаций в React 2026:
- `<motion.div>` — декларативные анимации
- `AnimatePresence` — анимации монтирования/размонтирования
- Layout animations — плавные изменения layout
- `useMotionValue`, `useSpring` — физические анимации

```tsx
// Пример: анимация карточки метрики
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
>
```

### 3.3 Таблицы — TanStack Table v8

Headless-библиотека для сложных таблиц:
- Виртуализация строк (10 000+ записей без лагов)
- Встроенная сортировка, фильтрация, пагинация
- Полный контроль над разметкой
- TypeScript-first

### 3.4 Графики — Recharts 3

- React-компоненты, SVG-рендеринг
- Адаптивные (`ResponsiveContainer`)
- Анимированное появление данных
- Кастомные tooltips и легенды

### 3.5 Формы — React Hook Form + Zod

```tsx
const schema = z.object({
  name: z.string().min(2),
  price: z.number().positive(),
})

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
})
```

- Минимальные ре-рендеры (uncontrolled)
- Интеграция с shadcn/ui Form-компонентами
- Валидация на клиенте и сервере одной схемой

### 3.6 Уведомления — Sonner

Замена react-toastify. Создана автором shadcn/ui, нативно интегрируется:
```tsx
import { Toaster, toast } from "sonner"
toast.success("Заказ обновлён")
```

### 3.7 Иконки — Lucide React

1400+ иконок, MIT-лицензия, tree-shaking, TypeScript:
```tsx
import { ShoppingCart, Users, Package } from "lucide-react"
```

### 3.8 Даты — date-fns v4

Модульная, tree-shakeable, без глобального состояния:
```tsx
import { format, formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"
format(new Date(), "d MMMM yyyy", { locale: ru })
```

### 3.9 Состояние таблиц/фильтров — nuqs

Синхронизация состояния фильтров с URL-параметрами:
- Фильтры сохраняются при обновлении страницы
- Можно поделиться ссылкой с применёнными фильтрами
```tsx
const [status, setStatus] = useQueryState("status")
```

### 3.10 Server Actions (Next.js 15)

Полный отказ от ручных API-роутов для мутаций:
```tsx
// app/orders/actions.ts
"use server"
export async function updateOrderStatus(id: string, status: OrderStatus) {
  await prisma.order.update({ where: { id }, data: { status } })
  revalidatePath("/orders")
}
```

---

## 4. ИТОГОВЫЙ СТЕК ДИЗАЙН-СИСТЕМЫ

| Категория | Технология |
|-----------|-----------|
| CSS-фреймворк | Tailwind CSS v4 |
| Компоненты | shadcn/ui (Radix UI) |
| Анимации | Motion (Framer Motion 12) |
| Иконки | Lucide React |
| Таблицы | TanStack Table v8 |
| Графики | Recharts 3 |
| Формы | React Hook Form + Zod |
| Уведомления | Sonner |
| Даты | date-fns v4 |
| URL-состояние | nuqs |
| Шрифты | next/font (Inter, Space Grotesk, JetBrains Mono) |

---

## 5. ПРОИЗВОДИТЕЛЬНОСТЬ И ДОСТУПНОСТЬ

### 5.1 Производительность
- React Server Components для всех страниц-списков (данные на сервере)
- Skeleton UI вместо спиннеров — нет layout shift
- `next/image` для всех изображений товаров (WebP, lazy load)
- Виртуализация в таблицах при > 100 строк
- `loading.tsx` на каждый роут — Suspense boundaries

### 5.2 Доступность (WCAG 2.2)
- Контраст текста: минимум 4.5:1 (AA)
- Навигация с клавиатуры: все интерактивные элементы
- ARIA-атрибуты на таблицах, модальных окнах, формах
- Focus-visible styles (видимый фокус при Tab)
- Radix UI — доступные примитивы из коробки

### 5.3 Адаптивность
| Брейкпоинт | Поведение |
|-----------|-----------|
| < 768px | Боковое меню скрыто (бургер), одна колонка |
| 768–1024px | Меню свёрнуто (только иконки) |
| > 1024px | Полное меню, многоколоночный layout |

---

## 6. РЕФЕРЕНСЫ И ИНСПИРАЦИЯ

- [Linear.app](https://linear.app) — эталон минимализма и скорости
- [Vercel Dashboard](https://vercel.com/dashboard) — glassmorphism + dark mode
- [Stripe Dashboard](https://dashboard.stripe.com) — типографика и таблицы
- [Shadcn/ui Blocks](https://ui.shadcn.com/blocks) — готовые блоки dashboard

---

## Источники

- [Top Admin Dashboard Design Ideas 2026](https://www.fanruan.com/en/blog/top-admin-dashboard-design-ideas-inspiration)
- [UI Design Trends 2026 — Tubik Blog](https://blog.tubikstudio.com/ui-design-trends-2026/)
- [8 Best Next.js Admin Dashboards With shadcn/ui](https://adminlte.io/blog/nextjs-admin-dashboards-shadcn/)
- [Tailwind v4 + shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4)
- [SmoothUI — Motion + shadcn](https://smoothui.dev)
- [Neumorphism vs Glassmorphism 2026](https://www.zignuts.com/blog/neumorphism-vs-glassmorphism)
- [Enterprise UX Design Guide 2026](https://fuselabcreative.com/enterprise-ux-design-guide-2026-best-practices/)
