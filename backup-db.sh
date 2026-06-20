#!/bin/bash
# Бэкап боевой SQLite-базы (postmanfox.db). Хранит последние 14 копий.
# Cron: 30 3 * * * /opt/postmanfox/backup-db.sh >> /opt/postmanfox/backups/backup.log 2>&1
set -e
SRC="/opt/postmanfox/data/postmanfox.db"
DEST_DIR="/opt/postmanfox/backups"
mkdir -p "$DEST_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$SRC" ".backup '$DEST_DIR/postmanfox-$STAMP.db'"
else
  cp "$SRC" "$DEST_DIR/postmanfox-$STAMP.db"
fi
ls -1t "$DEST_DIR"/postmanfox-*.db | tail -n +15 | xargs -r rm -f
echo "[backup] $STAMP ok"
