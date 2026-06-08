#!/usr/bin/env bash
#
# ProjectHub — SQLite backup script (great for a daily cron job on a Pi).
#
#   crontab -e
#   0 3 * * *  /home/pi/projecthub/scripts/backup-db.sh >> /home/pi/projecthub/backups/backup.log 2>&1
#
# Optional environment variables:
#   PROJECTHUB_BACKUP_DIR   where to write backups (default: <repo>/backups)
#   PROJECTHUB_BACKUP_KEEP  how many to keep    (default: 14)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$ROOT/prisma/dev.db"
DEST="${PROJECTHUB_BACKUP_DIR:-$ROOT/backups}"
KEEP="${PROJECTHUB_BACKUP_KEEP:-14}"

if [ ! -f "$DB" ]; then
  echo "[$(date)] No database found at $DB" >&2
  exit 1
fi

mkdir -p "$DEST"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST/projecthub-$TS.db"

# Prefer sqlite3's online .backup (safe while the app is running); else copy.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$OUT'"
else
  cp "$DB" "$OUT"
fi
echo "[$(date)] Backup written to $OUT"

# Prune: keep only the newest $KEEP backups.
ls -1t "$DEST"/projecthub-*.db 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
