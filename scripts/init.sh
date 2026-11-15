#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/.env"
EXAMPLE_FILE="$ROOT_DIR/.env.example"

FORCE=0
START_DOCKER=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --up) START_DOCKER=1 ;;
    -h|--help)
      echo "Usage: ./scripts/init.sh [--force] [--up]"
      echo "  --force  Regenerate AUTH_SECRET and POSTGRES_PASSWORD even if already set"
      echo "  --up     Run 'docker compose up -d' after generating .env"
      exit 0
      ;;
  esac
done

gen_base64_32() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '\n'
  elif command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"
  else
    LC_ALL=C tr -dc 'A-Za-z0-9+/' </dev/urandom | head -c 43
  fi
}

gen_hex_24() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24 | tr -d '\n'
  elif command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))"
  else
    LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 48
  fi
}

get_env_val() {
  key="$1"
  if [ ! -f "$ENV_FILE" ]; then
    return 0
  fi
  grep -E "^${key}=" "$ENV_FILE" | head -n 1 | cut -d '=' -f2- || true
}

set_env_val() {
  key="$1"
  val="$2"
  tmp_file="${ENV_FILE}.tmp.$$"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$val" '
      BEGIN { FS="="; OFS="=" }
      $1 == k { print k, v; next }
      { print }
    ' "$ENV_FILE" > "$tmp_file"
    mv "$tmp_file" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE_FILE" ]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    echo "[init] Created .env from .env.example"
  else
    touch "$ENV_FILE"
    echo "[init] Created empty .env"
  fi
else
  echo "[init] Using existing .env"
fi

CURRENT_AUTH=$(get_env_val "AUTH_SECRET")
if [ "$FORCE" -eq 1 ] || [ -z "$CURRENT_AUTH" ] || [ "$CURRENT_AUTH" = "change-me-to-a-secure-random-string" ]; then
  NEW_AUTH=$(gen_base64_32)
  set_env_val "AUTH_SECRET" "$NEW_AUTH"
  echo "[init] Generated AUTH_SECRET"
else
  echo "[init] Kept existing AUTH_SECRET"
fi

CURRENT_PG_USER=$(get_env_val "POSTGRES_USER")
[ -n "$CURRENT_PG_USER" ] || CURRENT_PG_USER="brief"

CURRENT_PG_DB=$(get_env_val "POSTGRES_DB")
[ -n "$CURRENT_PG_DB" ] || CURRENT_PG_DB="brief"

CURRENT_PG_PASS=$(get_env_val "POSTGRES_PASSWORD")
if [ "$FORCE" -eq 1 ] || [ -z "$CURRENT_PG_PASS" ] || [ "$CURRENT_PG_PASS" = "change-me-db-password" ] || [ "$CURRENT_PG_PASS" = "brief_local_dev" ] || [ "$CURRENT_PG_PASS" = "brief" ]; then
  NEW_PG_PASS=$(gen_hex_24)
  set_env_val "POSTGRES_USER" "$CURRENT_PG_USER"
  set_env_val "POSTGRES_PASSWORD" "$NEW_PG_PASS"
  set_env_val "POSTGRES_DB" "$CURRENT_PG_DB"
  set_env_val "DATABASE_URL" "postgresql://${CURRENT_PG_USER}:${NEW_PG_PASS}@postgres:5432/${CURRENT_PG_DB}"
  echo "[init] Generated POSTGRES_PASSWORD and updated DATABASE_URL (postgres:5432)"
else
  echo "[init] Kept existing POSTGRES_PASSWORD"
fi

chmod 600 "$ENV_FILE" 2>/dev/null || true

echo "[init] Done! Secrets are configured in .env (permissions 600)."

if [ "$START_DOCKER" -eq 1 ]; then
  echo "[init] Starting Docker Compose..."
  cd "$ROOT_DIR" && docker compose up -d
else
  echo "[init] Next step: docker compose up -d"
fi
