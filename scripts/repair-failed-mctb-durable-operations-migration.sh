#!/usr/bin/env bash
# One-shot repair when 20260914220000_mctb_durable_operations failed (wrong FK table name).
# Usage: DATABASE_URL=... bash scripts/repair-failed-mctb-durable-operations-migration.sh
set -euo pipefail
MIGRATION="20260914220000_mctb_durable_operations"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL required"
  exit 1
fi

echo "[repair] Dropping partial mctb_durable_operations table if present..."
npx prisma db execute --stdin <<'SQL'
DROP TABLE IF EXISTS "mctb_durable_operations" CASCADE;
SQL

echo "[repair] Marking migration rolled back: ${MIGRATION}"
npx prisma migrate resolve --rolled-back "${MIGRATION}"

echo "[repair] Re-applying migrations (ensure repo has Workspace FK fix)..."
npx prisma migrate deploy

echo "[repair] Done."
