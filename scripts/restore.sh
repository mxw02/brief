#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

get_env_val() {
  key="$1"
  [ -f "$ROOT_DIR/.env" ] || return 0
  grep -E "^${key}=" "$ROOT_DIR/.env" | head -n 1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true
}

ENV_PG_USER=$(get_env_val "POSTGRES_USER")
ENV_PG_DB=$(get_env_val "POSTGRES_DB")

ASSUME_YES=0
BACKUP_PATH=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --yes|-y)
      ASSUME_YES=1
      shift
      ;;
    -h|--help)
      echo "Usage: ./scripts/restore.sh [--yes] <backup-dir>"
      echo "  --yes, -y   Skip interactive confirmation prompt"
      exit 0
      ;;
    *)
      BACKUP_PATH="$1"
      shift
      ;;
  esac
done

if [ -z "$BACKUP_PATH" ] || [ ! -d "$BACKUP_PATH" ]; then
  echo "Usage: ./scripts/restore.sh [--yes] <backup-dir>" >&2
  exit 1
fi

ABS_BACKUP=$(CDPATH= cd -- "$BACKUP_PATH" && pwd)

# 1. Verify checksums if present
if [ -f "$ABS_BACKUP/SHA256SUMS" ]; then
  echo "[restore] Verifying SHA256SUMS..."
  (
    cd "$ABS_BACKUP"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum -c SHA256SUMS
    elif command -v shasum >/dev/null 2>&1; then
      shasum -a 256 -c SHA256SUMS
    fi
  )
fi

if [ "$ASSUME_YES" -ne 1 ]; then
  printf "[restore] This will overwrite current Brief data from '%s'. Continue? [y/N] " "$ABS_BACKUP"
  read -r answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *)
      echo "[restore] Aborted."
      exit 0
      ;;
  esac
fi

PG_USER="${POSTGRES_USER:-${ENV_PG_USER:-brief}}"
PG_DB="${POSTGRES_DB:-${ENV_PG_DB:-brief}}"

# 2. Restore database
if [ -f "$ABS_BACKUP/database.sql.gz" ]; then
  echo "[restore] Restoring PostgreSQL database '$PG_DB'..."
  docker compose up -d postgres
  gunzip -c "$ABS_BACKUP/database.sql.gz" | docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB"
elif [ -f "$ABS_BACKUP/brief.db" ]; then
  mkdir -p "$ROOT_DIR/.brief-data"
  cp "$ABS_BACKUP/brief.db" "$ROOT_DIR/.brief-data/brief.db"
  echo "[restore] Restored local SQLite database."
fi

# 3. Restore Docker volumes
restore_volume() {
  vol_suffix="$1"
  archive_name="$2"
  [ -f "$ABS_BACKUP/${archive_name}.tar.gz" ] || return 0

  vol_name=$(docker volume ls -q --filter "name=${vol_suffix}$" | head -n 1 || true)
  if [ -n "$vol_name" ]; then
    echo "[restore] Restoring Docker volume '$vol_name' from ${archive_name}.tar.gz..."
    docker run --rm \
      -v "${vol_name}:/target" \
      -v "${ABS_BACKUP}:/backup:ro" \
      alpine:3.20 \
      sh -c "rm -rf /target/* /target/.[!.]* 2>/dev/null || true; tar xzf /backup/${archive_name}.tar.gz -C /target"
  fi
}

restore_volume "brief_data" "brief_data"
restore_volume "brief_uploads" "brief_uploads"

echo "[restore] Done! Restarting Brief..."
docker compose up -d
