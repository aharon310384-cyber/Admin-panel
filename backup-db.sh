#!/bin/bash
# Бэкап боевой базы. Хранит последние 14 копий. Какая база — по DATABASE_URL в .env:
#   PostgreSQL → backups/postmanfox-ДАТА.dump (pg_dump, формат custom). Восстановление в пустую базу:
#     pg_restore --clean --if-exists --no-owner -d "<DATABASE_URL без ?schema=public>" backups/postmanfox-ДАТА.dump
#   SQLite (data/postmanfox.db) → backups/postmanfox-ДАТА.db
# Cron: 30 3 * * * /opt/postmanfox/backup-db.sh >> /opt/postmanfox/backups/backup.log 2>&1
set -euo pipefail
umask 077
APP="/opt/postmanfox"
DEST_DIR="$APP/backups"
mkdir -p "$DEST_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
URL=$(grep -m1 -E '^DATABASE_URL=' "$APP/.env" | cut -d= -f2- | tr -d "\"'")

case "$URL" in
  postgres*)
    # Сначала во временный файл: оборванная копия не займёт место среди 14 последних.
    pg_dump --format=custom --file="$DEST_DIR/.postmanfox-$STAMP.dump.tmp" "${URL%%\?*}"
    mv "$DEST_DIR/.postmanfox-$STAMP.dump.tmp" "$DEST_DIR/postmanfox-$STAMP.dump"
    ls -1t "$DEST_DIR"/postmanfox-*.dump | tail -n +15 | xargs -r rm -f
    ;;
  *)
    SRC="$APP/data/postmanfox.db"
    if command -v sqlite3 >/dev/null 2>&1; then
      sqlite3 "$SRC" ".backup '$DEST_DIR/postmanfox-$STAMP.db'"
    else
      cp "$SRC" "$DEST_DIR/postmanfox-$STAMP.db"
    fi
    ls -1t "$DEST_DIR"/postmanfox-*.db | tail -n +15 | xargs -r rm -f
    ;;
esac
echo "[backup] $STAMP ok"
