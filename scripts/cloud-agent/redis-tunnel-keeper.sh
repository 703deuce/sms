#!/usr/bin/env bash
# Keeps SSH tunnel to Coolify BullMQ Redis alive for the agent lifetime.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
while true; do
  if ssh -o BatchMode=yes -o ConnectTimeout=10 "${COOLIFY_SSH_HOST:-coolify-server}" true 2>/dev/null; then
    # shellcheck source=scripts/cloud-agent/ensure-self-hosted-redis-env.sh
    source "$ROOT/scripts/cloud-agent/ensure-self-hosted-redis-env.sh" || true
  fi
  sleep 45
done
