#!/bin/bash
# Обслуживание рабочего сервера из GitHub Actions (задача «Сервер», .github/workflows/server.yml).
# Запускается от root через /usr/local/bin/postmanfox-ci — точку входа SSH-ключа github-ci-postmanfox,
# которая берёт этот файл из origin/refactor/model-v2. Установка — docs/deploy/автодеплой.md.
#
#   status  — только смотрит: версия кода, база, PM2, диск, бэкап, ответ админки.
#   deploy  — бэкап базы → остановка админки → новый код → схема БД → обновления данных → сборка → запуск.
#             При ошибке код возвращается к прежней версии, админка собирается и запускается снова.
#   postgres — один раз: перевод базы с SQLite на PostgreSQL (установка, перенос и сверка данных, новый код).
#             При ошибке админка возвращается на SQLite и прежний код. Файл SQLite не меняется.
#
# Журнал задачи виден в GitHub Actions, а репозиторий публичный: не выводить секреты, адреса, пути к данным.
set -Eeuo pipefail

APP=/opt/postmanfox
BRANCH=refactor/model-v2
PM2_NAME=postmanfox
HEALTH_URL=http://127.0.0.1:45371/login
PG_NAME=postmanfox        # и база, и пользователь PostgreSQL
PG_MARK=postmanfox-admin  # комментарий к ним: так скрипт отличает свои от чужих

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
# При входе по SSH-ключу PATH короткий. Node и pm2 берём из того каталога,
# где лежит node, которым запущен демон PM2 (apt, nvm или свой каталог — неважно).
PM2_DAEMON=$(pgrep -f "God Daemon" | head -1 || true)
if [ -n "$PM2_DAEMON" ]; then
  PATH="$(dirname "$(readlink -f "/proc/$PM2_DAEMON/exe")"):$PATH"
fi
cd "$APP"

missing_tools() {
  local t missing=""
  for t in git node npm npx pm2 curl; do
    command -v "$t" >/dev/null 2>&1 || missing="$missing $t"
  done
  echo "$missing"
}

health_code() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" || true
}

wait_healthy() {
  for _ in $(seq 1 30); do
    [ "$(health_code)" = "200" ] && return 0
    sleep 2
  done
  return 1
}

pm2_state() {
  pm2 jlist 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const p = JSON.parse(s || "[]").find((x) => x.name === process.argv[1]);
      if (!p) return console.log("процесс не найден");
      const e = p.pm2_env || {};
      console.log(`${e.status}, перезапусков ${e.restart_time}, запущен ${new Date(e.pm_uptime).toISOString()}`);
    });' "$PM2_NAME"
}

# Все процессы PM2 на сервере (кроме админки там работает multi-agent) — чтобы после перезагрузки было видно, что поднялось всё.
pm2_all() {
  pm2 jlist 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const l = JSON.parse(s.slice(s.indexOf("[")));
        console.log(l.map((p) => `${p.name} ${(p.pm2_env || {}).status}`).join(", ") || "нет");
      } catch { console.log("не удалось прочитать"); }
    });'
}

# Список, который PM2 поднимет после перезагрузки (сохраняется командой pm2 save).
pm2_saved() {
  local dump="${PM2_HOME:-$HOME/.pm2}/dump.pm2"
  [ -f "$dump" ] || { echo "не сохранён"; return; }
  echo "$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).map((p) => p.name).join(", ") || "пусто")' "$dump" 2>/dev/null || echo "не удалось прочитать") (сохранён $(date -r "$dump" +%F))"
}

# DATABASE_URL из .env, без кавычек.
env_url() {
  grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"'" || true
}

db_kind() {
  case "$(env_url)" in
    file:*) echo sqlite ;;
    postgres*) echo postgresql ;;
    *) echo unknown ;;
  esac
}

# Провайдер базы в schema.prisma указанной версии кода: sqlite или postgresql.
schema_kind() {
  git show "$1:prisma/schema.prisma" 2>/dev/null |
    awk '/^datasource /{d=1} d && $1 == "provider" {gsub(/"/, "", $3); print $3; exit}'
}

# Путь к файлу SQLite (по умолчанию из .env). Относительный путь Prisma считает от каталога prisma/.
sqlite_path() {
  local p=${1-$(env_url)}
  p=${p#file:}
  case "$p" in /*) ;; *) p="$APP/prisma/$p" ;; esac
  realpath -m "$p"
}

# Адрес PostgreSQL для psql и pg_dump: без ?schema=…, которого они не понимают.
pg_url() {
  local u
  u=$(env_url)
  echo "${u%%\?*}"
}

# Команда от имени postgres — администратора PostgreSQL.
as_postgres() {
  (cd / && runuser -u postgres -- "$@")
}

# PID админки в PM2 и всех её дочерних процессов.
pm2_tree() {
  local root
  root=$(pm2 pid "$PM2_NAME" 2>/dev/null | tail -1)
  [ -n "$root" ] && [ "$root" != 0 ] || return 0
  ps -eo pid=,ppid= | awk -v r="$root" '{ parent[$1] = $2 }
    END { for (p in parent) { q = p; while (q + 0 != r + 0 && (q in parent) && q + 0 > 1) q = parent[q]; if (q + 0 == r + 0) print p } }'
}

# Кто кроме админки держит открытым файл базы SQLite.
sqlite_users() {
  local db=$1 own fd pid
  own=" $(pm2_tree | tr '\n' ' ') "
  for fd in /proc/[0-9]*/fd/*; do
    [ "$(readlink "$fd" 2>/dev/null)" = "$db" ] || continue
    pid=${fd#/proc/}
    pid=${pid%%/*}
    case "$own" in *" $pid "*) continue ;; esac
    echo "$(cat "/proc/$pid/comm" 2>/dev/null) (pid $pid)"
  done | sort -u | paste -sd, -
}

db_kind_of() {
  case "$1" in
    file:*) echo SQLite ;;
    postgres*) echo PostgreSQL ;;
    "") echo нет ;;
    *) echo неизвестно ;;
  esac
}

# Одна ли база у двух DATABASE_URL. У SQLite сравниваются пути к файлу.
same_db() {
  if [[ $1 == file:* && $2 == file:* ]]; then
    [ "$(sqlite_path "$1")" = "$(sqlite_path "$2")" ]
  else
    [ "$1" = "$2" ]
  fi
}

# DATABASE_URL в сохранённых настройках процессов PM2, строки «имя<TAB>значение» (пусто — не задан).
# Он важнее .env: Next.js и Prisma не перезаписывают уже заданные переменные.
# Значения только для сравнений внутри скрипта — в журнал не выводить, там бывает пароль.
pm2_db_urls() {
  pm2 jlist 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        for (const p of JSON.parse(s.slice(s.indexOf("[")))) {
          const e = p.pm2_env || {};
          console.log(`${p.name}\t${(e.env && e.env.DATABASE_URL) || e.DATABASE_URL || ""}`);
        }
      } catch {}
    });'
}

# Для status: у кого из процессов PM2 задан DATABASE_URL и та ли это база, что у админки.
pm2_db_report() {
  local name url line out="" admin
  admin=$(env_url)
  while IFS=$'\t' read -r name url; do
    [ -n "$name" ] || continue
    if [ -z "$url" ]; then
      line="$name — нет"
    elif same_db "$url" "$admin"; then
      line="$name — $(db_kind_of "$url"), та же база, что в .env админки"
    elif [[ $url == *postmanfox.db* ]]; then
      line="$name — SQLite, файл postmanfox.db, как у админки"
    else
      line="$name — $(db_kind_of "$url"), другая база"
    fi
    out="${out:+$out; }$line"
  done < <(pm2_db_urls)
  echo "${out:-не удалось прочитать}"
}

# Задан ли DATABASE_URL у самого PM2 (демона): его наследуют все процессы.
pm2_daemon_has_db() {
  [ -n "$PM2_DAEMON" ] && tr '\0' '\n' < "/proc/$PM2_DAEMON/environ" 2>/dev/null | grep -q '^DATABASE_URL='
}

# Процессы админки видят DATABASE_URL только такой или не видят вовсе (тогда берут из .env).
app_db_url_is() {
  local pid value
  for pid in $(pm2_tree); do
    value=$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | sed -n 's/^DATABASE_URL=//p' | head -1 || true)
    [ -z "$value" ] || [ "$value" = "$1" ] || return 1
  done
}

# Перезапуск админки с другим DATABASE_URL в настройках PM2. Остальные переменные PM2 сохраняет;
# env -i — чтобы в настройки не попало окружение этого SSH-сеанса.
pm2_restart_with_db() {
  env -i HOME="$HOME" PATH="$PATH" DATABASE_URL="$1" pm2 restart "$PM2_NAME" --update-env >/dev/null
}

status() {
  local missing
  missing=$(missing_tools)
  [ -z "$missing" ] || echo "!! Не найдены программы:$missing"
  echo "== Код"
  echo "Ветка: $(git branch --show-current)"
  echo "Стоит:     $(git log -1 --format='%h %ad %s' --date=short HEAD)"
  echo "В GitHub:  $(git log -1 --format='%h %ad %s' --date=short "origin/$BRANCH")"
  echo "Отстаёт от GitHub на коммитов: $(git rev-list --count "HEAD..origin/$BRANCH")"
  echo "Изменённых отслеживаемых файлов: $(git status --porcelain --untracked-files=no | wc -l)"
  echo "== База"
  case "$(db_kind)" in
    sqlite) echo "SQLite, $(du -h "$(sqlite_path)" 2>/dev/null | cut -f1)" ;;
    postgresql) echo "PostgreSQL $(psql -XAtq "$(pg_url)" -c "select current_setting('server_version') || ', ' || pg_size_pretty(pg_database_size(current_database()))" 2>/dev/null || echo "— не отвечает")" ;;
    *) echo "не удалось определить" ;;
  esac
  echo "Последний бэкап: $(ls -1t backups/postmanfox-*.db backups/postmanfox-*.dump 2>/dev/null | head -1 | xargs -r basename)"
  echo "Бэкапов: $(ls -1 backups/postmanfox-*.db backups/postmanfox-*.dump 2>/dev/null | wc -l), самый старый: $(ls -1tr backups/postmanfox-*.db backups/postmanfox-*.dump 2>/dev/null | head -1 | xargs -r basename)"
  local cron
  cron=$( { crontab -l 2>/dev/null; cat /etc/crontab /etc/cron.d/* 2>/dev/null; } | grep -v '^[[:space:]]*#' | grep -F backup-db.sh | head -1 || true)
  if [ -z "$cron" ]; then
    echo "Ночной бэкап в cron: не настроен"
  elif ! [ -x backup-db.sh ] && ! grep -qE '(bash|sh)[[:space:]]+[^[:space:]]*backup-db\.sh' <<<"$cron"; then
    echo "Ночной бэкап в cron: есть, но backup-db.sh не исполняемый — cron не сможет его запустить"
  else
    echo "Ночной бэкап в cron: есть ($(awk '{printf "%02d:%02d", $2, $1}' <<<"$cron"))"
  fi
  if command -v psql >/dev/null 2>&1; then
    echo "PostgreSQL на сервере: установлен, служба $(systemctl is-active postgresql 2>/dev/null || true)"
  else
    echo "PostgreSQL на сервере: не установлен"
  fi
  echo "== Приложение"
  echo "PM2 $PM2_NAME: $(pm2_state)"
  echo "Все процессы PM2: $(pm2_all)"
  echo "Поднимутся после перезагрузки: $(pm2_saved)"
  echo "DATABASE_URL в настройках PM2: $(pm2_db_report)"
  echo "DATABASE_URL у самого PM2: $(pm2_daemon_has_db && echo есть || echo нет)"
  local boot
  boot=$(systemctl is-enabled pm2-root 2>/dev/null || true)
  [ -z "$boot" ] || [ "$boot" = "not-found" ] && boot="не настроен"
  echo "Автозапуск PM2 после перезагрузки: $boot"
  echo "Админка отвечает: $(health_code)"
  echo "== Сервер"
  echo "Node $(node -v 2>/dev/null), npm $(npm -v 2>/dev/null)"
  df -h / | awk 'NR==2 {print "Диск: занято " $5 ", свободно " $4}'
  echo "Свободная память: $(free -m | awk '/^Mem:/ {print $7}') МБ"
  if [ -f /var/run/reboot-required ]; then echo "Нужна перезагрузка: да"; else echo "Нужна перезагрузка: нет"; fi
}

OLD=""
LOCK_CHANGED=0
ENV_BACKUP=""  # копия .env до перехода на PostgreSQL; при откате возвращается на место
ACTION="Деплой"
PM2_RESTORE_URL=""  # DATABASE_URL, который был в настройках PM2; при откате возвращается

rebuild_and_start() {
  if [ "$LOCK_CHANGED" = 1 ]; then npm ci --no-audit --no-fund; fi
  npx prisma generate
  npm run build
  if [ -n "$PM2_RESTORE_URL" ]; then
    pm2_restart_with_db "$PM2_RESTORE_URL"
  else
    pm2 start "$PM2_NAME"
  fi
}

rollback() {
  trap - ERR
  echo
  echo "!! Ошибка. Возвращаю код к $(git log -1 --format='%h' "$OLD") и запускаю админку."
  if [ -n "$ENV_BACKUP" ]; then
    cat "$ENV_BACKUP" > .env
    echo "!! Админка возвращается на SQLite. Файл SQLite не менялся."
  else
    echo "!! База не откатывается: свежий бэкап лежит в backups/."
  fi
  git reset -q --hard "$OLD"
  if rebuild_and_start && wait_healthy; then
    echo "!! Прежняя версия снова работает. $ACTION не выполнен."
  else
    echo "!! Прежняя версия не поднялась — нужен ручной разбор в консоли."
  fi
  exit 1
}

deploy() {
  local missing
  missing=$(missing_tools)
  [ -z "$missing" ] || { echo "Не найдены программы:$missing — деплой остановлен."; exit 1; }
  [ "$(git branch --show-current)" = "$BRANCH" ] || { echo "На сервере не ветка $BRANCH — деплой остановлен."; exit 1; }
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "На сервере есть изменённые файлы — деплой остановлен, чтобы их не потерять:"
    git status --short --untracked-files=no
    exit 1
  fi

  OLD=$(git rev-parse HEAD)
  local new
  new=$(git rev-parse "origin/$BRANCH")
  if [ "$OLD" = "$new" ]; then
    echo "Уже стоит последняя версия: $(git log -1 --format='%h %s')"
    exit 0
  fi
  if ! git diff --quiet "$OLD" "$new" -- package-lock.json; then LOCK_CHANGED=1; fi
  if [ "$(schema_kind "$new")" != "$(db_kind)" ]; then
    echo "Новая версия работает с базой $(schema_kind "$new"), а на сервере база $(db_kind) — деплой остановлен."
    [ "$(db_kind)" = sqlite ] && echo "Для перехода на PostgreSQL — команда postgres."
    exit 1
  fi

  echo "== Будет выкачено"
  git log --format='%h %ad %s' --date=short "$OLD..$new"

  echo "== Бэкап базы"
  bash backup-db.sh

  echo "== Остановка админки"
  pm2 stop "$PM2_NAME" >/dev/null
  trap rollback ERR

  echo "== Новый код"
  git merge --ff-only -q "origin/$BRANCH"
  if [ "$LOCK_CHANGED" = 1 ]; then
    echo "== Зависимости изменились — установка"
    npm ci --no-audit --no-fund
  fi

  echo "== Схема базы"
  npx prisma db push

  echo "== Обновления данных"
  npm run --if-present db:upgrade

  echo "== Сборка"
  npm run build

  echo "== Запуск"
  pm2 start "$PM2_NAME" >/dev/null
  wait_healthy || { echo "Админка не ответила после запуска."; false; }
  trap - ERR

  echo "== Готово: $(git log -1 --format='%h %s'), админка отвечает $(health_code)"
}

postgres_migrate() {
  ACTION="Переход на PostgreSQL"
  local missing
  missing=$(missing_tools)
  [ -z "$missing" ] || { echo "Не найдены программы:$missing — переход остановлен."; exit 1; }
  [ "$(git branch --show-current)" = "$BRANCH" ] || { echo "На сервере не ветка $BRANCH — переход остановлен."; exit 1; }
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "На сервере есть изменённые файлы — переход остановлен, чтобы их не потерять:"
    git status --short --untracked-files=no
    exit 1
  fi
  if [ "$(db_kind)" != sqlite ]; then
    echo "Админка уже не на SQLite (база: $(db_kind)) — переход не нужен."
    exit 1
  fi
  local new db users
  new=$(git rev-parse "origin/$BRANCH")
  if [ "$(schema_kind "$new")" != postgresql ]; then
    echo "В GitHub программа ещё на SQLite — сначала слейте изменения перехода на PostgreSQL."
    exit 1
  fi
  db=$(sqlite_path)
  [ -f "$db" ] || { echo "Не найден файл базы SQLite — переход остановлен."; exit 1; }
  users=$(sqlite_users "$db")
  if [ -n "$users" ]; then
    echo "Базу SQLite кроме админки держит открытой: $users — переход остановлен."
    echo "После перехода эта программа осталась бы на старой базе. Нужно сначала разобраться, что это."
    exit 1
  fi
  if pm2_daemon_has_db; then
    echo "DATABASE_URL задан в окружении самого PM2 — переход остановлен: админка взяла бы его, а не .env."
    exit 1
  fi
  # Если адрес базы записан и в настройках PM2 админки, при запуске он меняется и там.
  local pm2_url others
  pm2_url=$(pm2_db_urls | awk -F'\t' -v n="$PM2_NAME" '$1 == n { print $2; exit }')
  if [ -n "$pm2_url" ] && ! same_db "$pm2_url" "$(env_url)"; then
    echo "В настройках PM2 у админки указана другая база, чем в .env — переход остановлен."
    exit 1
  fi
  others=$(pm2_db_urls | while IFS=$'\t' read -r name url; do
    if [ "$name" != "$PM2_NAME" ] && [ -n "$url" ] && { same_db "$url" "$(env_url)" || [[ $url == *postmanfox.db* ]]; }; then
      echo "$name"
    fi
  done | paste -sd, -)
  if [ -n "$others" ]; then
    echo "В настройках PM2 у $others указана база админки (SQLite) — переход остановлен."
    echo "После перехода эта программа осталась бы на старой базе. Нужно решить, нужна ли ей база админки."
    exit 1
  fi
  OLD=$(git rev-parse HEAD)
  if ! git diff --quiet "$OLD" "$new" -- package-lock.json; then LOCK_CHANGED=1; fi

  echo "== PostgreSQL"
  if ! command -v psql >/dev/null 2>&1; then
    echo "Установка PostgreSQL…"
    DEBIAN_FRONTEND=noninteractive apt-get -qq -o DPkg::Lock::Timeout=600 update
    DEBIAN_FRONTEND=noninteractive apt-get -qq -o DPkg::Lock::Timeout=600 install -y postgresql >/dev/null
  fi
  systemctl enable --now postgresql >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do pg_isready -q -h 127.0.0.1 && break; sleep 1; done
  pg_isready -q -h 127.0.0.1 || { echo "PostgreSQL не запустился — переход остановлен."; exit 1; }
  echo "Версия: $(as_postgres psql -XAtqc 'show server_version')"

  # База и пользователь postmanfox. Если такие уже есть и созданы не этим скриптом — ничего не трогаем.
  local role_mark db_mark password
  role_mark=$(as_postgres psql -XAtqc "select coalesce(shobj_description(oid, 'pg_authid'), '-') from pg_roles where rolname = '$PG_NAME'")
  db_mark=$(as_postgres psql -XAtqc "select coalesce(shobj_description(oid, 'pg_database'), '-') from pg_database where datname = '$PG_NAME'")
  if { [ -n "$role_mark" ] && [ "$role_mark" != "$PG_MARK" ]; } || { [ -n "$db_mark" ] && [ "$db_mark" != "$PG_MARK" ]; }; then
    echo "В PostgreSQL уже есть база или пользователь $PG_NAME, созданные не этим скриптом — переход остановлен, чтобы их не задеть."
    exit 1
  fi
  # Пароль только в .env, в журнал не выводится.
  password=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  # Админка ещё на SQLite, значит база postmanfox в PostgreSQL не используется: остатки прошлой попытки удаляем.
  as_postgres psql -XAq -v ON_ERROR_STOP=1 -v pw="$password" >/dev/null <<SQL
SET client_min_messages = warning;
SELECT 'CREATE ROLE $PG_NAME LOGIN' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$PG_NAME') \gexec
ALTER ROLE $PG_NAME WITH LOGIN PASSWORD :'pw';
COMMENT ON ROLE $PG_NAME IS '$PG_MARK';
DROP DATABASE IF EXISTS $PG_NAME WITH (FORCE);
CREATE DATABASE $PG_NAME OWNER $PG_NAME TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8';
COMMENT ON DATABASE $PG_NAME IS '$PG_MARK';
SQL
  local url="postgresql://$PG_NAME:$password@127.0.0.1:5432/$PG_NAME?schema=public"
  psql -XAtq "${url%%\?*}" -c 'select 1' >/dev/null || { echo "Не удалось подключиться к новой базе — переход остановлен."; exit 1; }
  echo "База $PG_NAME готова."

  echo "== Будет выкачено"
  git log --format='%h %ad %s' --date=short "$OLD..$new"

  echo "== Остановка админки"
  pm2 stop "$PM2_NAME" >/dev/null
  mkdir -p backups
  ENV_BACKUP=backups/env-before-postgres
  install -m 600 .env "$ENV_BACKUP"
  trap rollback ERR

  echo "== Бэкап SQLite"
  bash backup-db.sh

  echo "== Новый код"
  git merge --ff-only -q "origin/$BRANCH"
  if [ "$LOCK_CHANGED" = 1 ]; then
    echo "== Зависимости изменились — установка"
    npm ci --no-audit --no-fund
  fi

  echo "== Таблицы в PostgreSQL"
  awk -v url="$url" '/^DATABASE_URL=/ { if (!done) print "DATABASE_URL=\"" url "\""; done = 1; next } { print }' "$ENV_BACKUP" > .env
  npx prisma db push

  echo "== Перенос данных из SQLite"
  SQLITE_URL="file:$db" npm run -s db:copy-from-sqlite

  echo "== Обновления данных"
  npm run --if-present db:upgrade

  echo "== Сборка"
  npm run build

  echo "== Запуск"
  if [ -n "$pm2_url" ]; then
    echo "Адрес базы записан и в настройках PM2 — меняю и там."
    PM2_RESTORE_URL=$pm2_url
    pm2_restart_with_db "$url"
  else
    pm2 start "$PM2_NAME" >/dev/null
  fi
  wait_healthy || { echo "Админка не ответила после запуска."; false; }
  app_db_url_is "$url" || { echo "Админка запустилась не с новой базой."; false; }
  trap - ERR
  # Сохранить настройки PM2, чтобы после перезагрузки админка поднялась с новой базой.
  [ -z "$pm2_url" ] || pm2 save >/dev/null

  echo "== Первый бэкап PostgreSQL"
  bash backup-db.sh || echo "!! Бэкап PostgreSQL не получился — админка работает, но backup-db.sh нужно проверить."

  echo "== Готово: админка работает на PostgreSQL, $(git log -1 --format='%h %s'), отвечает $(health_code)"
  echo "Файл SQLite оставлен на месте и больше не используется. Копия .env до перехода: $ENV_BACKUP."
}

case "${1:-status}" in
  status) status ;;
  deploy) deploy ;;
  postgres) postgres_migrate ;;
  *) echo "Неизвестная команда: ${1}. Доступны: status, deploy, postgres."; exit 2 ;;
esac
