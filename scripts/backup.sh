#!/bin/sh
set -eu
umask 077

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

get_env_val() {
  key="$1"
  [ -f "$ROOT_DIR/.env" ] || return 0
  grep -E "^${key}=" "$ROOT_DIR/.env" | head -n 1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true
}

ENV_BACKUP_DIR=$(get_env_val "BACKUP_DIR")
ENV_BACKUP_KEEP=$(get_env_val "BACKUP_KEEP")
ENV_PG_USER=$(get_env_val "POSTGRES_USER")
ENV_PG_DB=$(get_env_val "POSTGRES_DB")

BACKUP_ROOT="${BACKUP_DIR:-${ENV_BACKUP_DIR:-$ROOT_DIR/backups}}"
KEEP="${BACKUP_KEEP:-${ENV_BACKUP_KEEP:-14}}"
INCLUDE_ENV=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dir)
      [ "$#" -ge 2 ] || { echo "[backup] Missing argument for --dir" >&2; exit 1; }
      BACKUP_ROOT="$2"
      shift 2
      ;;
    --keep)
      [ "$#" -ge 2 ] || { echo "[backup] Missing argument for --keep" >&2; exit 1; }
      KEEP="$2"
      shift 2
      ;;
    --no-env)
      INCLUDE_ENV=0
      shift
      ;;
    -h|--help)
      echo "Usage: ./scripts/backup.sh [--dir <path>] [--keep <count>] [--no-env]"
      echo "  --dir <path>    Target directory for backups (default: ./backups)"
      echo "  --keep <count>  Number of recent backups to keep (default: 14)"
      echo "  --no-env        Skip copying .env into the backup directory"
      exit 0
      ;;
    *)
      echo "[backup] Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

TIMESTAMP=$(date -u +"%Y-%m-%d_%H-%M-%S")
TARGET_DIR="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$TARGET_DIR"

PG_USER="${POSTGRES_USER:-${ENV_PG_USER:-brief}}"
PG_DB="${POSTGRES_DB:-${ENV_PG_DB:-brief}}"

# 1. Database backup (PostgreSQL container or local SQLite fallback)
if command -v docker >/dev/null 2>&1 && docker compose ps -q postgres 2>/dev/null | grep -q .; then
  echo "[backup] Dumping PostgreSQL database '$PG_DB'..."
  docker compose exec -T postgres pg_dump -U "$PG_USER" -d "$PG_DB" --clean --if-exists | gzip > "$TARGET_DIR/database.sql.gz"
elif [ -f "$ROOT_DIR/.brief-data/brief.db" ]; then
  echo "[backup] Copying local SQLite database..."
  cp "$ROOT_DIR/.brief-data/brief.db" "$TARGET_DIR/brief.db"
else
  echo "[backup] Warning: Neither running 'postgres' container nor local SQLite DB found; skipping DB dump." >&2
fi

# 2. Docker volumes or local data/uploads directories
backup_volume() {
  vol_suffix="$1"
  out_name="$2"
  vol_name=""

  if command -v docker >/dev/null 2>&1; then
    vol_name=$(docker volume ls -q --filter "name=${vol_suffix}$" | head -n 1 || true)
  fi

  if [ -n "$vol_name" ]; then
    echo "[backup] Archiving Docker volume '$vol_name' -> ${out_name}.tar.gz"
    docker run --rm \
      -v "${vol_name}:/source:ro" \
      -v "${TARGET_DIR}:/backup" \
      alpine:3.20 \
      tar czf "/backup/${out_name}.tar.gz" -C /source .
  elif [ -d "$ROOT_DIR/$out_name" ]; then
    echo "[backup] Archiving local directory '$out_name' -> ${out_name}.tar.gz"
    tar czf "$TARGET_DIR/${out_name}.tar.gz" -C "$ROOT_DIR/$out_name" .
  fi
}

backup_volume "brief_data" "brief_data"
backup_volume "brief_uploads" "brief_uploads"

# 3. Environment secrets
if [ "$INCLUDE_ENV" -eq 1 ] && [ -f "$ROOT_DIR/.env" ]; then
  cp "$ROOT_DIR/.env" "$TARGET_DIR/env.backup"
  chmod 600 "$TARGET_DIR/env.backup"
  echo "[backup] Saved .env -> env.backup (permissions 600)"
fi

# 4. Checksums
(
  cd "$TARGET_DIR"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum * > SHA256SUMS 2>/dev/null || true
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 * > SHA256SUMS 2>/dev/null || true
  fi
)

# 5. Retention cleanup (keep newest N timestamped directories)
if [ "$KEEP" -gt 0 ] 2>/dev/null; then
  OLD_BACKUPS=$(ls -1dt "$BACKUP_ROOT"/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_* 2>/dev/null | tail -n +$((KEEP + 1)) || true)
  if [ -n "$OLD_BACKUPS" ]; then
    echo "$OLD_BACKUPS" | while IFS= read -r old_dir; do
      [ -n "$old_dir" ] && rm -rf "$old_dir" && echo "[backup] Pruned old backup: $old_dir"
    done
  fi
fi

echo "[backup] Completed: $TARGET_DIR"
