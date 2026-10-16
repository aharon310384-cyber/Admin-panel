#!/bin/bash
# Обслуживание рабочего сервера из GitHub Actions (задача «Сервер», .github/workflows/server.yml).
# Запускается от root через /usr/local/bin/postmanfox-ci — точку входа SSH-ключа github-ci-postmanfox,
# которая берёт этот файл из origin/refactor/model-v2. Установка — docs/deploy/автодеплой.md.
#
#   status  — только смотрит: версия кода, база, PM2, диск, бэкап, ответ админки.
#   deploy  — бэкап базы → остановка админки → новый код → схема БД → обновления данных → сборка → запуск.
#             При ошибке код возвращается к прежней версии, админка собирается и запускается снова.
#
# Журнал задачи виден в GitHub Actions, а репозиторий публичный: не выводить секреты, адреса, пути к данным.
set -Eeuo pipefail

APP=/opt/postmanfox
BRANCH=refactor/model-v2
PM2_NAME=postmanfox
HEALTH_URL=http://127.0.0.1:45371/login

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
  local url
  url=$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)
  case "$url" in
    file:*) echo "SQLite, $(du -h data/postmanfox.db 2>/dev/null | cut -f1)";;
    postgres*) echo "PostgreSQL";;
    *) echo "не удалось определить";;
  esac
  echo "Последний бэкап: $(ls -1t backups/*.db 2>/dev/null | head -1 | xargs -r basename)"
  echo "== Приложение"
  echo "PM2 $PM2_NAME: $(pm2_state)"
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

rebuild_and_start() {
  if [ "$LOCK_CHANGED" = 1 ]; then npm ci --no-audit --no-fund; fi
  npx prisma generate
  npm run build
  pm2 start "$PM2_NAME"
}

rollback() {
  trap - ERR
  echo
  echo "!! Ошибка. Возвращаю код к $(git log -1 --format='%h' "$OLD") и запускаю админку."
  echo "!! База не откатывается: свежий бэкап лежит в backups/."
  git reset -q --hard "$OLD"
  if rebuild_and_start && wait_healthy; then
    echo "!! Прежняя версия снова работает. Деплой не выполнен."
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

case "${1:-status}" in
  status) status ;;
  deploy) deploy ;;
  *) echo "Неизвестная команда: ${1}. Доступны: status, deploy."; exit 2 ;;
esac
