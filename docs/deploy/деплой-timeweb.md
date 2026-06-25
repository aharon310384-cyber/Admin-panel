# Деплой Postmanfox-system на Timeweb через Docker

Пошаговая инструкция для деплоя проекта (Next.js 15 + Prisma 6 + SQLite + NextAuth v5 + Telegram) на хостинг Timeweb через Docker.

> Подготовлено под реальное состояние репозитория:
> - `next.config.ts` уже содержит `output: "standalone"`.
> - База SQLite, боевой файл `data/postmanfox.db` (модель v2, результат миграции; `DATABASE_URL="file:../data/postmanfox.db"` локально, `file:/app/data/postmanfox.db` в Docker).
> - Артефакты деплоя (Dockerfile, docker-entrypoint.sh, .dockerignore, docker-compose.yml, Caddyfile, backup-db.sh) уже в репозитории и проверены локальной сборкой+запуском (20 июня).
> - entrypoint вызывает Prisma CLI напрямую (`node ./node_modules/prisma/build/index.js db push`), т.к. в standalone-образе нет `.bin`-симлинков.
> - Миграций Prisma нет — схема накатывается через `prisma db push` (НЕ `migrate dev`).
> - Файлы БД (`data/*.db`) в `.gitignore` — переносим на сервер вручную.
> - Секрет авторизации — `NEXTAUTH_SECRET` (плюс `NEXTAUTH_URL`). Клиентская сессия кабинета читает `AUTH_SECRET ?? NEXTAUTH_SECRET` — на проде достаточно задать `NEXTAUTH_SECRET`.

## 0. Выбор хостинга на Timeweb
Основной путь: Timeweb Cloud VPS, Ubuntu 22.04/24.04 LTS, 2 vCPU / 2–4 GB RAM / 30+ GB NVMe, статический IP, SSH-ключ. Альтернатива (кратко): «Облачные приложения» и managed PostgreSQL Timeweb — проще, но хуже под файловую SQLite. Переезд между серверами Timeweb = скопировать `data/` и поднять compose.

## 1. Файлы в репозитории
### 1.1 schema.prisma — добавить binaryTargets
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```
(для alpine — `linux-musl-openssl-3.0.x`)

### 1.2 Dockerfile (multi-stage, node:20-slim, standalone)
```dockerfile
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV DATABASE_URL="file:./build-placeholder.db"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
RUN mkdir -p /app/data /app/public/uploads && chown -R nextjs:nodejs /app/data /app/public/uploads
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chown nextjs:nodejs /app/docker-entrypoint.sh
USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

### 1.3 docker-entrypoint.sh
```sh
#!/bin/sh
set -e
echo "[entrypoint] prisma db push..."
node ./node_modules/prisma/build/index.js db push --skip-generate
echo "[entrypoint] starting Next.js..."
exec node server.js
```

### 1.4 .dockerignore
```
node_modules
.next
.git
.env
.env.*
!.env.example
data
public/uploads
Downloads
*.log
.claude
.vscode
.idea
```

## 2. Подготовка сервера
```bash
ssh root@SERVER_IP
apt update && apt -y upgrade
apt -y install git curl ufw
# опц. swap при 2GB RAM:
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 3. Перенос кода и базы
```bash
mkdir -p /opt && cd /opt
git clone <URL_РЕПО> postmanfox
cd /opt/postmanfox
# БД (нет в git):
ssh root@SERVER_IP "mkdir -p /opt/postmanfox/data"
scp data/postmanfox.db root@SERVER_IP:/opt/postmanfox/data/postmanfox.db
```
Переезд между серверами Timeweb: `docker compose stop app` затем `rsync -avz -e ssh root@OLD_IP:/opt/postmanfox/data/ root@NEW_IP:/opt/postmanfox/data/`.

## 4. .env на сервере (chmod 600)
```dotenv
DATABASE_URL="file:/app/data/postmanfox.db"
NEXTAUTH_SECRET="ДЛИННЫЙ_СЛУЧАЙНЫЙ"     # openssl rand -base64 32
NEXTAUTH_URL="https://ВАШ_ДОМЕН"
NEXT_PUBLIC_APP_URL="https://ВАШ_ДОМЕН"
TELEGRAM_BOT_TOKEN="123456:ПРОД_ТОКЕН"
TELEGRAM_WEBHOOK_SECRET="СЛУЧАЙНАЯ_СТРОКА"
NEXT_PUBLIC_TELEGRAM_BOT_NAME="postmanfox_prod_bot"
UPLOAD_DIR="public/uploads"
```
`NEXT_PUBLIC_*` вшиваются на этапе сборки — собирайте, зная домен. Отдельный прод-бот (webhook у бота один!). `.env` не в git и не в образе.

## 5. docker-compose.yml + Caddyfile
```yaml
services:
  app:
    build: { context: ., dockerfile: Dockerfile }
    container_name: postmanfox-app
    restart: unless-stopped
    env_file: [.env]
    volumes:
      - ./data:/app/data
      - ./public/uploads:/app/public/uploads
    expose: ["3000"]
    networks: [web]
  caddy:
    image: caddy:2
    container_name: postmanfox-caddy
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [app]
    networks: [web]
networks: { web: {} }
volumes: { caddy_data: {}, caddy_config: {} }
```
```caddy
ВАШ_ДОМЕН {
    encode gzip zstd
    reverse_proxy app:3000
}
```

## 6. Первый деплой
```bash
cd /opt/postmanfox
docker compose build
docker compose up -d
docker compose logs -f app
```

## 7. nginx + certbot (кратко, альтернатива Caddy)
nginx:alpine с proxy_pass на `http://app:3000`; `certbot certonly --standalone -d ВАШ_ДОМЕН`; пути fullchain/privkey в nginx, редирект 80→443, `certbot renew` по cron. Caddy предпочтительнее (авто-сертификаты из коробки).

## 8. Telegram на проде
```bash
BOT_TOKEN="123456:ПРОД_ТОКЕН"; DOMAIN="https://ВАШ_ДОМЕН"; WEBHOOK_SECRET="ИЗ_.env"
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" -d "url=${DOMAIN}/api/telegram/webhook" -d "secret_token=${WEBHOOK_SECRET}"
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" -H "Content-Type: application/json" \
  -d "{\"menu_button\":{\"type\":\"web_app\",\"text\":\"Открыть кабинет\",\"web_app\":{\"url\":\"${DOMAIN}/entrance\"}}}"
```

## 9. Обновления
```bash
cd /opt/postmanfox && git pull && docker compose build && docker compose up -d && docker compose logs -f app
```
Схема: `db push` в entrypoint; `migrate dev` НЕ использовать. Откат: `git checkout <тег> && docker compose build && docker compose up -d` (БД в томе не трогается).

## 10. Бэкапы SQLite (cron)
```bash
#!/bin/bash
set -e
SRC="/opt/postmanfox/data/postmanfox.db"; DEST_DIR="/opt/postmanfox/backups"
mkdir -p "$DEST_DIR"; STAMP=$(date +%Y%m%d-%H%M%S)
if command -v sqlite3 >/dev/null 2>&1; then sqlite3 "$SRC" ".backup '$DEST_DIR/admin-panel-$STAMP.db'"; else cp "$SRC" "$DEST_DIR/admin-panel-$STAMP.db"; fi
ls -1t "$DEST_DIR"/admin-panel-*.db | tail -n +15 | xargs -r rm -f
```
```
30 3 * * * /opt/postmanfox/backup-db.sh >> /opt/postmanfox/backups/backup.log 2>&1
```
Опц. S3: `aws --endpoint-url=https://s3.timeweb.cloud s3 cp ... s3://БАКЕТ/db-backups/`.

## 11. Чек-лист перед открытием клиентам
- [ ] Домен → IP, https с валидным сертификатом Caddy
- [ ] binaryTargets добавлен, образ собирается
- [ ] data/postmanfox.db на сервере, том примонтирован, данные видны
- [ ] cron-бэкап работает
- [ ] .env только на сервере (chmod 600), не в git/образе
- [ ] NEXTAUTH_SECRET случайный, URL'ы = реальный домен
- [ ] отдельный прод-бот, токен в .env
- [ ] setWebhook + getWebhookInfo ок, Menu Button → /entrance
- [ ] демо-пароли (если есть) не используются
- [ ] вход в кабинет, привязка по контакту, страницы проверены
- [ ] ufw включён (22/80/443), root по ключу
- [ ] docker compose ps — app и caddy running

## 12. Опция: переход на PostgreSQL (managed Timeweb)
schema.prisma → `provider = "postgresql"`; `DATABASE_URL="postgresql://USER:PASS@HOST:5432/DB?sslmode=require"`; `prisma db push` на пустую базу + перенос данных (pgloader); volume `./data` больше не нужен, `public/uploads` оставить.

---

## Что уточнить у пользователя (от агента)
1. Домен для кабинета/админки (заменить `ВАШ_ДОМЕН`).
2. Прод-бот Telegram — создан ли отдельный бот у @BotFather (не тот, через который ведётся общение)?
3. Базовый образ: `node:20-slim` (рекомендуется) или `alpine` (тогда `binaryTargets = linux-musl-openssl-3.0.x`)?
4. БД на старте: SQLite в Docker-томе (просто) или сразу managed PostgreSQL Timeweb (надёжнее под рост/переезд)?
