#!/usr/bin/env bash
# Queue a Coolify web app (application id 1) deploy using a full git commit SHA.
# Run from dev machine with ssh coolify-server configured.
#
#   COMMIT=$(git rev-parse HEAD) bash scripts/coolify-queue-web-deploy.sh
#   bash scripts/coolify-queue-web-deploy.sh --wait
set -euo pipefail

COMMIT="${COMMIT:-$(git rev-parse HEAD 2>/dev/null || true)}"
WAIT=false
for arg in "$@"; do
  case "$arg" in
    --wait) WAIT=true ;;
  esac
done

if [[ -z "$COMMIT" || ${#COMMIT} -lt 40 ]]; then
  echo "Set COMMIT to a full 40-char git SHA (got: ${COMMIT:-empty})" >&2
  exit 1
fi

echo "[coolify-web] checking for existing queue for commit=${COMMIT}"
EXISTING="$(ssh coolify-server "docker exec coolify-db psql -U coolify -d coolify -t -A -F'|' -c \"
  SELECT id, status FROM application_deployment_queues
  WHERE application_id::text = '1' AND commit = '${COMMIT}'
    AND status IN ('queued', 'in_progress', 'finished')
  ORDER BY id DESC LIMIT 1;
\"")"
if [[ -n "${EXISTING}" ]]; then
  DEPLOY_ID="${EXISTING%%|*}"
  STATUS="${EXISTING#*|}"
  echo "[coolify-web] skip duplicate queue — deployment id=${DEPLOY_ID} status=${STATUS} (webhook may already have queued this commit)"
  if [[ "$WAIT" == true && "$STATUS" != "finished" ]]; then
    echo "[coolify-web] --wait: polling existing deployment"
  else
    exit 0
  fi
else
  echo "[coolify-web] queue deploy commit=${COMMIT}"
  ssh coolify-server "docker exec coolify php artisan tinker --execute=\"
\\\$app = App\\\\Models\\\\Application::find(1);
if (!\\\$app) { throw new Exception('application 1 missing'); }
\\\$uuid = new_public_id();
queue_application_deployment(\\\$app, \\\$uuid, 0, '${COMMIT}', true, false, true, false, null, true);
echo 'deployment_uuid=' . \\\$uuid;
\""
fi

if [[ "$WAIT" != true ]]; then
  echo "[coolify-web] queued (pass --wait to poll until finished)"
  exit 0
fi

for ((i = 1; i <= 40; i++)); do
  ROW="$(ssh coolify-server "docker exec coolify-db psql -U coolify -d coolify -t -A -F'|' -c \"
    SELECT id, status FROM application_deployment_queues
    WHERE application_id::text = '1' AND commit = '${COMMIT}'
    ORDER BY id DESC LIMIT 1;
  \"")"
  DEPLOY_ID="${ROW%%|*}"
  STATUS="${ROW#*|}"
  echo "[coolify-web] poll ${i}/40 id=${DEPLOY_ID:-?} status=${STATUS:-unknown}"
  if [[ "$STATUS" == "finished" ]]; then
    curl -sS "${PRODUCTION_BASE_URL:-https://transovo.ai}/api/health" | head -c 200
    echo
    exit 0
  fi
  if [[ "$STATUS" == "failed" ]]; then
    echo "[coolify-web] FAILED — check application_deployment_queues id=${DEPLOY_ID}" >&2
    exit 1
  fi
  sleep 45
done

echo "[coolify-web] timeout waiting for deploy" >&2
exit 1
