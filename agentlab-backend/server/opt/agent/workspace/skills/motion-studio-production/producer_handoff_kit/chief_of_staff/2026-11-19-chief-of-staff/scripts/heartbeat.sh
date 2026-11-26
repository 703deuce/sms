#!/usr/bin/env bash
# Renew a Motion Studio job lease via /checkpoint every 60s. Never prints secrets.
# Required env: MOTION_JOB_URL, MOTION_JOB_TOKEN
set +x
set -euo pipefail
: "${MOTION_JOB_URL:?MOTION_JOB_URL required}"
: "${MOTION_JOB_TOKEN:?MOTION_JOB_TOKEN required}"
LOG="${HEARTBEAT_LOG:-/tmp/motion_heartbeat.log}"

while true; do
  ts=$(date +%Y-%m-%dT%H:%M:%S%z)
  code=$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${MOTION_JOB_TOKEN}" \
    --max-time 12 \
    "${MOTION_JOB_URL%/}/checkpoint" || echo "err")
  echo "$ts checkpoint=$code" >> "$LOG"
  if [ "$code" = "401" ] || [ "$code" = "403" ]; then
    echo "$ts lease lost ($code), stopping heartbeat" >> "$LOG"
    exit 1
  fi
  sleep 60
done
