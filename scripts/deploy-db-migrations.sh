#!/usr/bin/env bash
# Apply committed Prisma migrations to the target database (production/staging).
# Coolify: set DATABASE_URL on the web app so this runs on every deploy.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[db-deploy] DATABASE_URL is not set — skipping prisma migrate deploy (local/image build without DB)."
  exit 0
fi

FAILED_MCTB_DURABLE_OPS_MIGRATION="20260914220000_mctb_durable_operations"

recover_failed_mctb_durable_operations_migration() {
  echo "[db-deploy] Recovering failed migration ${FAILED_MCTB_DURABLE_OPS_MIGRATION} (drop partial table + mark rolled back)..."
  npx prisma db execute --stdin <<'SQL' || true
DROP TABLE IF EXISTS "mctb_durable_operations" CASCADE;
SQL
  npx prisma migrate resolve --rolled-back "${FAILED_MCTB_DURABLE_OPS_MIGRATION}" || true
}

echo "[db-deploy] Applying Prisma migrations..."
set +e
deploy_out="$(npx prisma migrate deploy 2>&1)"
deploy_code=$?
set -e
echo "$deploy_out"

if [[ "$deploy_code" -ne 0 ]]; then
  if echo "$deploy_out" | grep -q "${FAILED_MCTB_DURABLE_OPS_MIGRATION}"; then
    recover_failed_mctb_durable_operations_migration
    echo "[db-deploy] Retrying prisma migrate deploy after recovery..."
    npx prisma migrate deploy
  else
    exit "$deploy_code"
  fi
fi

echo "[db-deploy] Database schema is up to date."
