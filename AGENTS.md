# Многоагентная система — Админ-панель

Этот проект использует специализированных агентов Claude Code.
Агенты находятся в `.claude/agents/` и автоматически подключаются при запуске.

---

## Команда агентов

### Разработка

| Агент | Когда вызывать |
|-------|---------------|
| `nextjs-developer` | Страницы, компоненты, формы, таблицы, Server Actions |
| `backend-developer` | Prisma, PostgreSQL, NextAuth, API-роуты, миграции |
| `code-reviewer` | После каждого значимого изменения кода |
| `ui-designer` | Стили, компоненты, анимации, адаптивность |

### Маркетинг

| Агент | Когда вызывать |
|-------|---------------|
| `market-analyst` | Анализ конкурентов, исследование рынка, УТП |
| `copywriter` | Тексты UI, лендинг, README, описания |
| `seo-specialist` | Метаданные, sitemap, ключевые слова |

### Координация

| Агент | Когда вызывать |
|-------|---------------|
| `project-manager` | Планирование спринтов, декомпозиция задач |

---

## Правила работы агентов

1. **Один файл — один агент** одновременно
2. **Backend** создаёт API → **frontend** использует его
3. **code-reviewer** запускается после каждого этапа
4. Агенты читают `technical-specification.md`, `research.md`, `design-requirements.md` перед началом

---

## MCP-серверы
- `obsidian` — синхронизация заметок с Obsidian Vault

---

## Контекст для агентов

Always use Context7 when you need library or framework documentation.
Always use the Obsidian MCP to read project notes from the vault when needed.
