#!/usr/bin/env bash
# Trigger a real Coolify build for transovo-sms-worker (app id 3) and wait for health parity.
#
# Uses queue_application_deployment() via coolify-restore-transovo-voice-worker.sh — NOT a raw
# INSERT into application_deployment_queues (those rows never build without ApplicationDeploymentJob).
#
# From dev machine:
#   COMMIT=$(git rev-parse HEAD)
#   ssh coolify-server "COMMIT=${COMMIT} bash -s" < scripts/coolify-deploy-sms-worker-and-verify.sh
#
# On Coolify host (repo checked out):
#   COMMIT=d88bb425... bash scripts/coolify-deploy-sms-worker-and-verify.sh
set -euo pipefail

COMMIT="${COMMIT:-${VOICE_GIT_COMMIT:-${GITHUB_SHA:-HEAD}}}"
SMS_APP_ID="${SMS_APP_ID:-3}"
POLL_SEC="${POLL_SEC:-45}"
MAX_POLLS="${MAX_POLLS:-40}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[coolify-sms-worker] deploy commit=${COMMIT}"
export VOICE_GIT_COMMIT="$COMMIT"
bash scripts/coolify-restore-transovo-voice-worker.sh --deploy-sms

echo "[coolify-sms-worker] waiting for application_id=${SMS_APP_ID} deploy status=finished ..."
DEPLOY_ID=""
for ((i = 1; i <= MAX_POLLS; i++)); do
  ROW="$(docker exec coolify-db psql -U coolify -d coolify -t -A -F'|' -c \
    "SELECT id, status FROM application_deployment_queues WHERE application_id = '${SMS_APP_ID}' AND commit LIKE '${COMMIT}%' ORDER BY id DESC LIMIT 1;")"
  DEPLOY_ID="${ROW%%|*}"
  STATUS="${ROW#*|}"
  echo "[coolify-sms-worker] poll ${i}/${MAX_POLLS} deploy_id=${DEPLOY_ID:-?} status=${STATUS:-unknown}"
  if [[ "$STATUS" == "finished" ]]; then
    break
  fi
  if [[ "$STATUS" == "failed" ]]; then
    echo "[coolify-sms-worker] FAILED — check Coolify logs for queue id ${DEPLOY_ID}"
    docker exec coolify-db psql -U coolify -d coolify -t -A -c \
      "SELECT left(logs, 2000) FROM application_deployment_queues WHERE id = ${DEPLOY_ID};" | head -c 2000
    exit 1
  fi
  sleep "$POLL_SEC"
done

if [[ "${STATUS:-}" != "finished" ]]; then
  echo "[coolify-sms-worker] timeout waiting for deploy (last status=${STATUS:-unknown})"
  exit 1
fi

CONTAINER="$(docker ps --format '{{.Names}}' | grep -E '^fd7b2fe8172414e3320776281a-' | head -1 || true)"
if [[ -z "$CONTAINER" ]]; then
  echo "[coolify-sms-worker] no running SMS worker container found"
  exit 1
fi

IMAGE="$(docker inspect "$CONTAINER" --format '{{.Config.Image}}')"
echo "[coolify-sms-worker] container=${CONTAINER} image=${IMAGE}"

IP="$(docker inspect "$CONTAINER" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')"
HEALTH="$(curl -sS --max-time 8 "http://${IP}:8082/health" || true)"
echo "[coolify-sms-worker] health=${HEALTH}"

if ! echo "$HEALTH" | grep -q "\"commitSha\":\"${COMMIT}"; then
  if ! echo "$HEALTH" | grep -q "${COMMIT:0:12}"; then
    echo "[coolify-sms-worker] health commitSha does not match ${COMMIT}"
    exit 1
  fi
fi

echo "[coolify-sms-worker] PASS deploy finished + worker health matches ${COMMIT}"
