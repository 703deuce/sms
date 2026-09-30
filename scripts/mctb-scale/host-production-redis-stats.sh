#!/usr/bin/env bash
# Read-only Redis stats from production web container (no benchmark writes).
set -euo pipefail
HOST="${COOLIFY_SSH_HOST:-coolify-server}"
WEB="${MCTB_PROD_WEB_CONTAINER:-ds8s3hjin60qs6g7s0iqkixs-125104185699}"
ssh -o BatchMode=yes "$HOST" \
  "docker exec $WEB sh -c 'cd /app && NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/mctb-scale/redis-stats.ts'"
