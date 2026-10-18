#!/bin/bash
# Проверка отслеживания посылок (17TRACK) по расписанию. Ставит server.sh deploy в /etc/cron.d/postmanfox-tracking.
# Зовёт админку на этом же сервере с ключом TRACKING_CRON_KEY из .env; итог — в системный журнал (journalctl -t postmanfox-tracking).
set -euo pipefail
cd /opt/postmanfox
key=$(grep -E '^TRACKING_CRON_KEY=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"'" || true)
[ -n "$key" ] || { echo "TRACKING_CRON_KEY нет в .env — пропуск"; exit 0; }
curl -sS -m 600 -X POST -H "x-cron-key: $key" http://127.0.0.1:45371/api/tracking/sync
echo
