#!/usr/bin/env bash
# Point clips-worker WORKER_CALLBACK_URL at the live web container (coolify network, bypasses proxy 502).
set -euo pipefail
HOST="${1:-coolify-server}"
WEB_FILTER="${WEB_CONTAINER_FILTER:-ds8s3hjin}"
ENV_FILE="${WORKER_ENV_FILE:-/opt/clips-worker/worker.env}"

WEB=$(ssh -o BatchMode=yes "$HOST" "docker ps --format '{{.Names}}' | grep -E '${WEB_FILTER}' | head -1")
if [[ -z "$WEB" ]]; then
  echo "No web container matching ${WEB_FILTER}"
  exit 1
fi
URL="http://${WEB}:3000"
ssh -o BatchMode=yes "$HOST" "grep -q '^WORKER_CALLBACK_URL=' ${ENV_FILE} 2>/dev/null && sed -i 's|^WORKER_CALLBACK_URL=.*|WORKER_CALLBACK_URL=${URL}|' ${ENV_FILE} || echo WORKER_CALLBACK_URL=${URL} >> ${ENV_FILE}"
echo "[sync-worker-callback] WORKER_CALLBACK_URL=${URL}"
echo "[sync-worker-callback] restart clips-worker when RUNNING jobs = 0 to pick up env"
