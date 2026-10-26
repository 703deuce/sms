#!/usr/bin/env bash
# Apply committed Prisma migrations to the target database (production/staging).
# Coolify: set DATABASE_URL on the web app so this runs on every deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="${ROOT}/prisma/schema.prisma"
prisma() {
  (cd "${ROOT}/new-app" && npx --yes pnpm@12.3.4 exec prisma --schema="${SCHEMA}" "$@")
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[db-deploy] DATABASE_URL is not set — skipping prisma migrate deploy (local/image build without DB)."
  exit 0
fi

FAILED_MCTB_DURABLE_OPS_MIGRATION="20260914220000_mctb_durable_operations"
FAILED_VOICE_V2_AI_CALL_RECOVERY_MIGRATION="20260916190000_voice_v2_ai_call_recovery"
FAILED_VOICE_OPERATIONAL_OVERRIDES_MIGRATION="20260916194500_voice_operational_overrides"

recover_failed_voice_operational_overrides_migration() {
  echo "[db-deploy] Recovering failed migration ${FAILED_VOICE_OPERATIONAL_OVERRIDES_MIGRATION} (drop partial table + mark rolled back)..."
  prisma db execute --stdin <<'SQL' || true
DROP TABLE IF EXISTS "voice_operational_overrides" CASCADE;
SQL
  prisma migrate resolve --rolled-back "${FAILED_VOICE_OPERATIONAL_OVERRIDES_MIGRATION}" || true
}

recover_failed_voice_v2_ai_call_recovery_migration() {
  echo "[db-deploy] Recovering failed migration ${FAILED_VOICE_V2_AI_CALL_RECOVERY_MIGRATION} (drop partial table + mark rolled back)..."
  prisma db execute --stdin <<'SQL' || true
DROP TABLE IF EXISTS "voice_v2_ai_call_recovery_sessions" CASCADE;
SQL
  prisma migrate resolve --rolled-back "${FAILED_VOICE_V2_AI_CALL_RECOVERY_MIGRATION}" || true
}

recover_failed_mctb_durable_operations_migration() {
  echo "[db-deploy] Recovering failed migration ${FAILED_MCTB_DURABLE_OPS_MIGRATION} (drop partial table + mark rolled back)..."
  prisma db execute --stdin <<'SQL' || true
DROP TABLE IF EXISTS "mctb_durable_operations" CASCADE;
SQL
  prisma migrate resolve --rolled-back "${FAILED_MCTB_DURABLE_OPS_MIGRATION}" || true
}

migrate_status="$(prisma migrate status 2>&1 || true)"
if echo "$migrate_status" | grep -F "${FAILED_VOICE_V2_AI_CALL_RECOVERY_MIGRATION}" | grep -qiE 'failed|not yet applied'; then
  recover_failed_voice_v2_ai_call_recovery_migration
fi
if echo "$migrate_status" | grep -F "${FAILED_VOICE_OPERATIONAL_OVERRIDES_MIGRATION}" | grep -qiE 'failed|not yet applied'; then
  recover_failed_voice_operational_overrides_migration
fi

echo "[db-deploy] Applying Prisma migrations..."
set +e
deploy_out="$(prisma migrate deploy 2>&1)"
deploy_code=$?
set -e
echo "$deploy_out"

if [[ "$deploy_code" -ne 0 ]]; then
  if echo "$deploy_out" | grep -q "${FAILED_VOICE_OPERATIONAL_OVERRIDES_MIGRATION}"; then
    recover_failed_voice_operational_overrides_migration
    echo "[db-deploy] Retrying prisma migrate deploy after operational overrides migration recovery..."
    prisma migrate deploy
  elif echo "$deploy_out" | grep -q "${FAILED_VOICE_V2_AI_CALL_RECOVERY_MIGRATION}"; then
    recover_failed_voice_v2_ai_call_recovery_migration
    echo "[db-deploy] Retrying prisma migrate deploy after AI call recovery migration recovery..."
    prisma migrate deploy
  elif echo "$deploy_out" | grep -q "${FAILED_MCTB_DURABLE_OPS_MIGRATION}"; then
    recover_failed_mctb_durable_operations_migration
    echo "[db-deploy] Retrying prisma migrate deploy after recovery..."
    prisma migrate deploy
  else
    exit "$deploy_code"
  fi
fi

echo "[db-deploy] Database schema is up to date."
