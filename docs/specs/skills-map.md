---
tags: [скиллы, агенты, индекс]
---

# Skills Map агентов

Каждый агент команды получил набор глобальных скиллов и MCP-инструментов под свою специализацию. Скиллы — это «прокачки», которые Claude умеет вызывать автоматически при подходящей задаче.

## Как читать карту

- **Глобальные скиллы** — установлены через плагины Claude Code, доступны всем агентам, но включены в работу выборочно.
- **MCP-инструменты** — внешние интеграции (Context7, Obsidian, Stitch). Агент использует их, когда задача требует свежих доков, заметок или макетов.
- **User-tools (review, simplify, security-review)** — пользовательские скиллы Claude Code: запускаются и автоматически, и через `/команду`.

## Команды и их скиллы

### 🎯 Координаторы

| Агент | Скиллы |
|-------|--------|
| [[orchestrator]] | claude-automation-recommender · claude-md-improver · session-report · agent-development · mcp:obsidian |
| [[project-manager]] | claude-md-improver · session-report · claude-automation-recommender · mcp:obsidian · mcp:context7 |

### 💻 Разработка

| Агент | Скиллы |
|-------|--------|
| [[tech-lead]] | agent-development · mcp:context7 · claude-md-improver · review · simplify |
| [[nextjs-developer]] | **frontend-design** · mcp:context7 · mcp:stitch · simplify |
| [[backend-developer]] | mcp:context7 · security-review · simplify |
| [[ui-designer]] | **frontend-design** · mcp:stitch · mcp:context7 |
| [[code-reviewer]] | review · security-review · simplify · mcp:context7 |
| [[db-architect]] | mcp:context7 |
| [[api-builder]] | mcp:context7 · security-review |
| [[component-builder]] | frontend-design · mcp:context7 · mcp:stitch |
| [[page-builder]] | frontend-design · mcp:context7 |
| [[security-auditor]] | **security-review** · writing-hookify-rules · mcp:context7 |
| [[performance-auditor]] | mcp:context7 · simplify · session-report |

### 📣 Маркетинг

| Агент | Скиллы |
|-------|--------|
| [[marketing-lead]] | mcp:obsidian · mcp:context7 |
| [[market-analyst]] | WebSearch · mcp:obsidian · mcp:context7 |
| [[competitor-researcher]] | WebSearch · mcp:obsidian |
| [[copywriter]] | WebSearch · mcp:obsidian · mcp:context7 |
| [[ui-writer]] | mcp:obsidian |
| [[seo-specialist]] | WebSearch · mcp:context7 · mcp:obsidian |

## Карточки скиллов

### Глобальные скиллы

- [[Скиллы/frontend-design]] — авторский UI без AI-aesthetics
- [[Скиллы/claude-md-improver]] — аудит CLAUDE.md
- [[Скиллы/claude-automation-recommender]] — рекомендации по автоматизации
- [[Скиллы/agent-development]] — создание субагентов
- [[Скиллы/writing-hookify-rules]] — правила автоматических предупреждений
- [[Скиллы/session-report]] — отчёт по расходам токенов
- [[Скиллы/security-review]] — глубокий security-audit
- [[Скиллы/review]] — структурированный обзор PR
- [[Скиллы/simplify]] — упрощение кода

### MCP-инструменты

- [[Скиллы/mcp-context7]] — свежие доки по библиотекам
- [[Скиллы/mcp-obsidian]] — работа с Obsidian Vault
- [[Скиллы/mcp-stitch]] — генерация UI-макетов

## Связи

↑ Родитель: [[README]] · [[AGENTS]]
↓ Карточки: см. папку `Скиллы/`
