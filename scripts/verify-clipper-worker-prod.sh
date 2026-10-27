#!/usr/bin/env bash
# Verify clips-worker deploy + callback env (names only — never print secret values).
# Usage: ./scripts/verify-clipper-worker-prod.sh [expected_git_sha_prefix] [ssh-host]
set -euo pipefail

EXPECTED_SHA="${1:-}"
HOST="${2:-coolify-server}"

ssh "$HOST" bash <<'REMOTE'
set -euo pipefail
for name in clips-worker clips-worker-stream; do
  if ! docker ps --format '{{.Names}}' | grep -qx "$name"; then
    echo "FATAL: container $name not running" >&2
    exit 1
  fi
done
IMG1=$(docker inspect clips-worker --format '{{.Config.Image}}')
IMG2=$(docker inspect clips-worker-stream --format '{{.Config.Image}}')
echo "clips-worker image=$IMG1"
echo "clips-worker-stream image=$IMG2"
if [ "$IMG1" != "$IMG2" ]; then
  echo "WARN: worker images differ" >&2
fi
for name in clips-worker clips-worker-stream; do
  echo "=== $name ==="
  docker exec "$name" cat /app/CLIPS_WORKER_GIT_SHA 2>/dev/null || echo "MISSING CLIPS_WORKER_GIT_SHA"
  for key in WORKER_SHARED_SECRET WORKER_CALLBACK_URL TRANSOVO_BACKEND_URL APP_URL DATABASE_URL; do
    if docker exec "$name" sh -c "test -n \"\${$key:-}\""; then
      echo "  ${key}=set"
    else
      echo "  ${key}=MISSING"
    fi
  done
done
echo "=== web app env (key names) ==="
grep -E '^(WORKER_SHARED_SECRET|WORKER_CALLBACK_URL|TRANSOVO_BACKEND_URL|APP_URL)=' \
  /data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env 2>/dev/null \
  | cut -d= -f1 | sort -u || echo "web env file not readable"
REMOTE

if [[ -n "$EXPECTED_SHA" ]]; then
  echo "[verify] expected CLIPS_WORKER_GIT_SHA prefix: ${EXPECTED_SHA:0:12}"
fi
