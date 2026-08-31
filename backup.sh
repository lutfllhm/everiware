#!/bin/bash
# Backup database + folder uploads Everiware.
# Jalankan dari /opt/everiware di VPS: ./backup.sh
# Bisa dijadwalkan via cron, misal setiap hari jam 02:00:
#   0 2 * * * cd /opt/everiware && ./backup.sh >> backup/backup.log 2>&1

set -euo pipefail

cd "$(dirname "$0")"

# Baca DB_ROOT_PASSWORD dan DB_NAME dari .env, fallback ke default docker-compose.yml
DB_ROOT_PASSWORD=$(grep -E '^DB_ROOT_PASSWORD=' .env 2>/dev/null | cut -d '=' -f2- || true)
DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD:-root_password_secure}
DB_NAME=$(grep -E '^DB_NAME=' .env 2>/dev/null | cut -d '=' -f2- || true)
DB_NAME=${DB_NAME:-iware_presence}

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="backup"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Mulai backup..."

# 1. Backup database
DB_BACKUP_FILE="$BACKUP_DIR/db_${DATE}.sql"
docker exec everiware_db mysqldump -u root -p"$DB_ROOT_PASSWORD" --no-tablespaces "$DB_NAME" > "$DB_BACKUP_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database dibackup ke $DB_BACKUP_FILE"

# 2. Backup folder uploads (volume Docker everiware_backend_uploads)
UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads_${DATE}.tar.gz"
docker run --rm \
  -v everiware_backend_uploads:/data:ro \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  alpine tar czf "/backup/uploads_${DATE}.tar.gz" -C /data .
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploads dibackup ke $UPLOADS_BACKUP_FILE"

# 3. Hapus backup yang lebih tua dari RETENTION_DAYS
find "$BACKUP_DIR" -name "db_*.sql" -mtime "+${RETENTION_DAYS}" -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup selesai. File tersimpan di $BACKUP_DIR/"
