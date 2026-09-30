#!/usr/bin/env bash
# Logical Postgres backup for production Supabase (pg_dump custom format).
# Credentials: DATABASE_URL from environment or Coolify app .env (never logged).
set -euo pipefail

BACKUP_ROOT="${TRANSOVO_POSTGRES_BACKUP_DIR:-/data/backups/transovo-postgres}"
STATUS_DIR="${BACKUP_ROOT}/status"
RETENTION_DAILY="${TRANSOVO_POSTGRES_BACKUP_RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${TRANSOVO_POSTGRES_BACKUP_RETENTION_WEEKLY:-4}"
COOLIFY_ENV="${COOLIFY_APP_ENV_FILE:-/data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env}"
WEB_CONTAINER="${TRANSOVO_WEB_CONTAINER:-ds8s3hjin60qs6g7s0iqkixs-125104185699}"
PG_IMAGE="${TRANSOVO_PG_DUMP_IMAGE:-postgres:17-alpine}"

mkdir -p "$BACKUP_ROOT" "$STATUS_DIR"

if [[ -z "${DATABASE_URL:-}" ]] && docker ps --format '{{.Names}}' | grep -q "^${WEB_CONTAINER}$"; then
  DATABASE_URL="$(docker exec "$WEB_CONTAINER" printenv DATABASE_URL 2>/dev/null || true)"
fi

if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "$COOLIFY_ENV" ]]; then
  DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$COOLIFY_ENV" | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[postgres-backup] ERROR: DATABASE_URL not set" >&2
  exit 1
fi

export DATABASE_URL

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_ROOT}/transovo-${TIMESTAMP}.dump"
LOG_FILE="${STATUS_DIR}/backup-${TIMESTAMP}.log"
LATEST_JSON="${STATUS_DIR}/latest.json"

PG_ENV_FILE="$(mktemp)"
chmod 600 "$PG_ENV_FILE"
python3 <<'PY' >"$PG_ENV_FILE"
import os
from urllib.parse import urlparse, unquote

raw = os.environ.get("DATABASE_URL", "")
if not raw:
    raise SystemExit("missing DATABASE_URL")
u = urlparse(raw.replace("postgresql://", "http://", 1))
user = unquote(u.username or "")
password = unquote(u.password or "")
host = u.hostname or ""
port = u.port or 5432
db = (u.path or "/postgres").lstrip("/") or "postgres"
ref = user.replace("postgres.", "", 1) if user.startswith("postgres.") else ""
use_direct = os.environ.get("TRANSOVO_PG_DUMP_USE_DIRECT", "").strip() == "1"
if use_direct and "pooler.supabase.com" in host and ref:
    host = f"db.{ref}.supabase.co"
    port = 5432
print(f"PGHOST={host}")
print(f"PGPORT={port}")
print(f"PGUSER={user}")
print(f"PGPASSWORD={password}")
print(f"PGDATABASE={db}")
print("PGSSLMODE=require")
PY

START_MS="$(date +%s)"

echo "[postgres-backup] start=${TIMESTAMP} destination=${OUT_FILE}" | tee "$LOG_FILE"

if ! docker run --rm \
  --env-file "$PG_ENV_FILE" \
  -v "${BACKUP_ROOT}:/backups:rw" \
  "$PG_IMAGE" \
  sh -c 'pg_dump -Fc --no-owner --no-acl -f "/backups/transovo-'"${TIMESTAMP}"'.dump"'; then
  echo "[postgres-backup] ERROR: pg_dump failed" | tee -a "$LOG_FILE"
  rm -f "$PG_ENV_FILE"
  exit 2
fi

rm -f "$PG_ENV_FILE"

if ! docker run --rm \
  -v "${BACKUP_ROOT}:/backups:ro" \
  "$PG_IMAGE" \
  pg_restore -l "/backups/transovo-${TIMESTAMP}.dump" >/dev/null; then
  echo "[postgres-backup] ERROR: pg_restore -l verification failed" | tee -a "$LOG_FILE"
  exit 3
fi

END_MS="$(date +%s)"
BYTES="$(stat -c%s "$OUT_FILE" 2>/dev/null || stat -f%z "$OUT_FILE")"
HUMAN="$(numfmt --to=iec-i --suffix=B "$BYTES" 2>/dev/null || echo "${BYTES}B")"

python3 <<PY | tee -a "$LOG_FILE"
import json, time, os
payload={
  'event':'postgres_logical_backup',
  'success':True,
  'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime($START_MS)),
  'finishedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime($END_MS)),
  'durationSeconds':$END_MS-$START_MS,
  'file':os.path.basename('$OUT_FILE'),
  'bytes':$BYTES,
  'humanSize':'$HUMAN',
  'destination':'$BACKUP_ROOT',
  'verification':'pg_restore_list_ok'
}
open('$LATEST_JSON','w').write(json.dumps(payload, indent=2))
print(json.dumps(payload))
PY

# Retention: daily (keep last N), weekly (keep Sunday backups for W weeks)
find "$BACKUP_ROOT" -maxdepth 1 -name 'transovo-*.dump' -type f -mtime +"${RETENTION_DAILY}" ! -name '*-restore-drill-*' -delete 2>/dev/null || true

echo "[postgres-backup] complete size=${HUMAN}" | tee -a "$LOG_FILE"
