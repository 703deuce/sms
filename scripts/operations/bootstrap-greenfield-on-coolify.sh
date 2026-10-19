#!/usr/bin/env bash
# Run on Cloud Agent: create greenfield DB on production Supabase + apply Prisma migrations.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COOLIFY_ENV="/data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env"
GREENFIELD_DB_NAME="${GREENFIELD_DB_NAME:-transovo_greenfield}"
REMOTE_URL_FILE="/tmp/transovo-greenfield-database.url"
REMOTE_BOOT="/tmp/transovo-greenfield-bootstrap"

echo "[bootstrap] Syncing create-db scripts to Coolify host..."
ssh -o BatchMode=yes coolify-server "rm -rf '${REMOTE_BOOT}' && mkdir -p '${REMOTE_BOOT}'"
scp -q \
  "$ROOT/scripts/operations/create-greenfield-database-same-instance.sh" \
  "$ROOT/scripts/operations/_pg_url_utils.py" \
  "coolify-server:${REMOTE_BOOT}/"

echo "[bootstrap] Creating database on Coolify host (same Supabase instance)..."
ssh -o BatchMode=yes coolify-server \
  "GREENFIELD_DB_NAME='${GREENFIELD_DB_NAME}' GREENFIELD_RECREATE='${GREENFIELD_RECREATE:-}' COOLIFY_ENV_FILE='${COOLIFY_ENV}' GREENFIELD_URL_FILE='${REMOTE_URL_FILE}' bash '${REMOTE_BOOT}/create-greenfield-database-same-instance.sh'"

echo "[bootstrap] Applying Prisma migrations from this workspace..."
LOCAL_URL_FILE="$(mktemp)"
chmod 600 "$LOCAL_URL_FILE"
scp -q "coolify-server:${REMOTE_URL_FILE}" "$LOCAL_URL_FILE"
export GREENFIELD_DATABASE_URL
GREENFIELD_DATABASE_URL="$(cat "$LOCAL_URL_FILE")"
rm -f "$LOCAL_URL_FILE"

export LEGACY_DATABASE_URL
LEGACY_DATABASE_URL="$(
  ssh coolify-server "python3 - '${COOLIFY_ENV}'" <<'PY'
import sys
path = sys.argv[1]
for line in open(path, encoding="utf-8"):
    if line.startswith("DATABASE_URL="):
        val = line.split("=", 1)[1].strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        print(val, end="")
        break
PY
)"

cd "$ROOT"
GREENFIELD_ALLOW_LEGACY_HOST=1 bash scripts/operations/provision-greenfield-database.sh

echo "[bootstrap] Schema parity check..."
export LEGACY_DATABASE_URL GREENFIELD_DATABASE_URL
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/verify-greenfield-schema-parity.ts

echo "[bootstrap] Done. Greenfield DB: ${GREENFIELD_DB_NAME}"
echo "[bootstrap] Greenfield URL on server: ${REMOTE_URL_FILE} (use for Coolify DATABASE_URL cutover)"
