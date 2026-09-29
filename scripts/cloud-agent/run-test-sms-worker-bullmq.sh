#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if ssh -o BatchMode=yes -o ConnectTimeout=5 "${COOLIFY_SSH_HOST:-coolify-server}" true 2>/dev/null; then
  # shellcheck source=scripts/cloud-agent/ensure-self-hosted-redis-env.sh
  source scripts/cloud-agent/ensure-self-hosted-redis-env.sh
fi
export NODE_OPTIONS="${NODE_OPTIONS:---import ./scripts/preload-server-only.mjs}"
exec npx tsx scripts/test-sms-worker-bullmq.ts
