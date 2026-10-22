#!/usr/bin/env bash
# Restart the Coolify web app (application id 1) with current env from Coolify DB —
# no Nixpacks/Docker rebuild. Use after changing DATABASE_URL / Supabase keys only.
#
#   bash scripts/coolify-restart-web-runtime.sh
#   bash scripts/coolify-restart-web-runtime.sh --wait
#
# Note: NEXT_PUBLIC_* values baked into the existing image are unchanged until a full deploy.
set -euo pipefail

WAIT=false
for arg in "$@"; do
  case "$arg" in
    --wait) WAIT=true ;;
  esac
done

echo "[coolify-restart] queue restart-only (no build) for application 1"
OUT="$(ssh coolify-server "docker exec coolify php artisan tinker --execute=\"
\\\$app = App\\\\Models\\\\Application::find(1);
if (!\\\$app) { throw new Exception('application 1 missing'); }
\\\$uuid = new_public_id();
\\\$result = queue_application_deployment(\\\$app, \\\$uuid, 0, null, false, false, true, true, null, true);
echo 'deployment_uuid=' . \\\$uuid . PHP_EOL;
if (is_array(\\\$result)) { echo json_encode(\\\$result) . PHP_EOL; }
\"")"
echo "$OUT"

if [[ "$WAIT" != true ]]; then
  echo "[coolify-restart] queued (pass --wait to poll)"
  exit 0
fi

for ((i = 1; i <= 20; i++)); do
  ROW="$(ssh coolify-server "docker exec coolify-db psql -U coolify -d coolify -t -A -F'|' -c \"
    SELECT id, status, restart_only FROM application_deployment_queues
    WHERE application_id::text = '1'
    ORDER BY id DESC LIMIT 1;
  \"")"
  DEPLOY_ID="${ROW%%|*}"
  REST="${ROW#*|}"
  STATUS="${REST%%|*}"
  echo "[coolify-restart] poll ${i}/20 id=${DEPLOY_ID} status=${STATUS}"
  if [[ "$STATUS" == "finished" ]]; then
    ssh coolify-server "docker inspect \$(docker ps --format '{{.Names}}' | grep '^ds8s3hjin60qs6g7s0iqkixs-' | head -1) --format '{{range .Config.Env}}{{println .}}{{end}}' | grep NEXT_PUBLIC_SUPABASE_URL || true"
    curl -sS "${PRODUCTION_BASE_URL:-https://transovo.ai}/api/health" | head -c 250
    echo
    exit 0
  fi
  if [[ "$STATUS" == "failed" ]]; then
    echo "[coolify-restart] FAILED id=${DEPLOY_ID}" >&2
    exit 1
  fi
  sleep 15
done
echo "[coolify-restart] timeout waiting" >&2
exit 1
