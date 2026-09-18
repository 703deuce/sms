#!/usr/bin/env bash
# One-time Coolify ops: scheduler skips Next build; no auto-deploy on every master push.
# Run on the Coolify host with DB access: bash scripts/coolify-configure-scheduler-build.sh
set -euo pipefail

SCHEDULER_APP_ID=2
RESOURCEABLE_TYPE='App\Models\Application'

psql_exec() {
  docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 -c "$1"
}

echo "[coolify-scheduler] disable auto-deploy for application_id=${SCHEDULER_APP_ID}"
psql_exec "UPDATE application_settings SET is_auto_deploy_enabled = false, updated_at = NOW() WHERE application_id = ${SCHEDULER_APP_ID};"

echo "[coolify-scheduler] ensure COOLIFY_SKIP_NEXT_BUILD=1 (build-time only)"
exists="$(
  docker exec coolify-db psql -U coolify -d coolify -t -A \
    -c "SELECT count(*) FROM environment_variables WHERE resourceable_type = '${RESOURCEABLE_TYPE}' AND resourceable_id = ${SCHEDULER_APP_ID} AND key = 'COOLIFY_SKIP_NEXT_BUILD';" \
    | tr -d '[:space:]'
)"

if [[ "${exists}" == "0" ]]; then
  docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 <<SQL
INSERT INTO environment_variables (
  key, value, is_preview, is_shown_once, is_multiline, version, is_literal, uuid,
  is_required, is_shared, resourceable_type, resourceable_id, is_runtime, is_buildtime,
  created_at, updated_at
) VALUES (
  'COOLIFY_SKIP_NEXT_BUILD', '1', false, false, false, '4.0.0', false,
  gen_random_uuid()::text, false, false, '${RESOURCEABLE_TYPE}', ${SCHEDULER_APP_ID},
  false, true, NOW(), NOW()
);
SQL
else
  psql_exec "UPDATE environment_variables SET value = '1', is_buildtime = true, is_runtime = false, updated_at = NOW()
    WHERE resourceable_type = '${RESOURCEABLE_TYPE}' AND resourceable_id = ${SCHEDULER_APP_ID} AND key = 'COOLIFY_SKIP_NEXT_BUILD';"
fi

echo "[coolify-scheduler] done — redeploy scheduler manually when worker deps change"
