#!/usr/bin/env bash
# Capture non-secret Supabase rebuild inventory from Coolify production web container.
# Safe to run before deleting a Supabase project. Writes JSON under TRANSOVO_REBUILD_INVENTORY_DIR.
set -euo pipefail

OUT_DIR="${TRANSOVO_REBUILD_INVENTORY_DIR:-/data/backups/transovo-rebuild-inventory}"
COOLIFY_ENV="${COOLIFY_APP_ENV_FILE:-/data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env}"
CONTAINER_PREFIX="${TRANSOVO_WEB_CONTAINER_PREFIX:-ds8s3hjin60qs6g7s0iqkixs}"
BACKUP_ROOT="${TRANSOVO_POSTGRES_BACKUP_DIR:-/data/backups/transovo-postgres}"
PG_IMAGE="${TRANSOVO_PG_DUMP_IMAGE:-postgres:17-alpine}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${OUT_DIR}/inventory-${TIMESTAMP}.json"
LATEST="${OUT_DIR}/latest.json"

mkdir -p "$OUT_DIR"

resolve_web_container() {
  docker ps --format '{{.Names}}' | grep -E "^${CONTAINER_PREFIX}-" | head -1 || true
}

WEB_CONTAINER="$(resolve_web_container)"

read_env_from_container() {
  local key="$1"
  if [[ -n "$WEB_CONTAINER" ]]; then
    docker exec "$WEB_CONTAINER" printenv "$key" 2>/dev/null || true
  fi
}

SUPABASE_URL="$(read_env_from_container NEXT_PUBLIC_SUPABASE_URL)"
DATABASE_URL="$(read_env_from_container DATABASE_URL)"

if [[ -z "$SUPABASE_URL" && -f "$COOLIFY_ENV" ]]; then
  SUPABASE_URL="$(grep -m1 '^NEXT_PUBLIC_SUPABASE_URL=' "$COOLIFY_ENV" | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
fi
if [[ -z "$DATABASE_URL" && -f "$COOLIFY_ENV" ]]; then
  DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$COOLIFY_ENV" | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
fi

ENV_NAMES="[]"
if [[ -n "$WEB_CONTAINER" ]]; then
  ENV_NAMES="$(docker exec "$WEB_CONTAINER" printenv | grep -E '^(DATABASE_URL|NEXT_PUBLIC_SUPABASE|SUPABASE_)' | cut -d= -f1 | sort -u | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"
fi

PROJECT_HOST=""
PROJECT_REF=""
if [[ -n "$SUPABASE_URL" ]]; then
  PROJECT_HOST="$(python3 -c "from urllib.parse import urlparse; print(urlparse('${SUPABASE_URL}').hostname or '')")"
  PROJECT_REF="${PROJECT_HOST%.supabase.co}"
  PROJECT_REF="${PROJECT_REF#https://}"
fi

BACKUP_DUMPS="[]"
if [[ -d "$BACKUP_ROOT" ]]; then
  BACKUP_DUMPS="$(find "$BACKUP_ROOT" -maxdepth 1 -name 'transovo-*.dump' -type f -printf '%f\n' 2>/dev/null | sort | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"
fi

POSTGRES_REACHABLE=false
POSTGRES_REACHABLE_JSON="false"
WORKSPACE_COUNT=""
MIGRATION_COUNT=""
DB_SIZE=""

if [[ -n "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL
  PG_ENV_FILE="$(mktemp)"
  chmod 600 "$PG_ENV_FILE"
  python3 <<'PY' >"$PG_ENV_FILE"
import os
from urllib.parse import urlparse, unquote
raw = os.environ.get("DATABASE_URL", "")
u = urlparse(raw.replace("postgresql://", "http://", 1))
print(f"PGHOST={u.hostname}")
print(f"PGPORT={u.port or 5432}")
print(f"PGUSER={unquote(u.username or '')}")
print(f"PGPASSWORD={unquote(u.password or '')}")
print(f"PGDATABASE={(u.path or '/postgres').lstrip('/')}")
print("PGSSLMODE=require")
PY
  if docker run --rm --env-file "$PG_ENV_FILE" "$PG_IMAGE" psql -t -A -c "SELECT 1" >/dev/null 2>&1; then
    POSTGRES_REACHABLE=true
    POSTGRES_REACHABLE_JSON="true"
    WORKSPACE_COUNT="$(docker run --rm --env-file "$PG_ENV_FILE" "$PG_IMAGE" psql -t -A -c 'SELECT count(*)::bigint FROM "Workspace";' 2>/dev/null || echo "")"
    MIGRATION_COUNT="$(docker run --rm --env-file "$PG_ENV_FILE" "$PG_IMAGE" psql -t -A -c 'SELECT count(*)::bigint FROM _prisma_migrations;' 2>/dev/null || echo "")"
    DB_SIZE="$(docker run --rm --env-file "$PG_ENV_FILE" "$PG_IMAGE" psql -t -A -c "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null || echo "")"
  fi
  rm -f "$PG_ENV_FILE"
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRISMA_MIGRATION_DIRS="${PRISMA_MIGRATION_FOLDERS_IN_REPO:-}"
if [[ -z "$PRISMA_MIGRATION_DIRS" && -d "${REPO_ROOT}/prisma/migrations" ]]; then
  PRISMA_MIGRATION_DIRS="$(find "${REPO_ROOT}/prisma/migrations" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
fi
PRISMA_MIGRATION_DIRS="${PRISMA_MIGRATION_DIRS:-unknown}"

python3 <<PY >"$OUT_FILE"
import json
payload = {
  "event": "supabase_rebuild_inventory",
  "capturedAt": "${TIMESTAMP}",
  "coolifyWebContainer": "${WEB_CONTAINER:-}",
  "coolifyAppUuid": "${CONTAINER_PREFIX}",
  "supabaseProjectHost": "${PROJECT_HOST}",
  "supabaseProjectRef": "${PROJECT_REF}",
  "envVarNamesPresent": json.loads('''${ENV_NAMES}'''),
  "postgresReachable": True if "${POSTGRES_REACHABLE}" == "true" else False,
  "postgresDatabaseSize": "${DB_SIZE}",
  "workspaceCount": "${WORKSPACE_COUNT}" if "${WORKSPACE_COUNT}" else None,
  "prismaMigrationsAppliedCount": "${MIGRATION_COUNT}" if "${MIGRATION_COUNT}" else None,
  "prismaMigrationFoldersInRepo": (
    int("${PRISMA_MIGRATION_DIRS}") if "${PRISMA_MIGRATION_DIRS}".isdigit() else "${PRISMA_MIGRATION_DIRS}"
  ),
  "schemaAuthority": "prisma/schema.prisma + prisma/migrations",
  "storageBucketsExpected": [
    "voicemail-greetings",
    "call-recordings",
    "mms-media",
    "fax-documents",
    "ui-references",
    "visualizer-media",
    "reports",
  ],
  "backupDumpsOnHost": json.loads('''${BACKUP_DUMPS}'''),
  "rebuildDoc": "docs/operations/SUPABASE-PROJECT-REBUILD-MANIFEST.md",
  "notes": "No passwords or API keys in this file. Update Coolify DATABASE_URL and Supabase keys after creating a new project.",
}
print(json.dumps(payload, indent=2))
PY

cp "$OUT_FILE" "$LATEST"
echo "[rebuild-inventory] wrote ${OUT_FILE}"
cat "$OUT_FILE"
