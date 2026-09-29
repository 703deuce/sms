#!/usr/bin/env bash
# Safe MCTB scale smoke (no real Telnyx/SMS/email). Requires DATABASE_URL + Redis tunnel.
set -euo pipefail
cd "$(dirname "$0")/../.."
if ssh -o BatchMode=yes -o ConnectTimeout=5 "${COOLIFY_SSH_HOST:-coolify-server}" true 2>/dev/null; then
  # shellcheck source=scripts/cloud-agent/ensure-self-hosted-redis-env.sh
  source scripts/cloud-agent/ensure-self-hosted-redis-env.sh
fi
export NODE_OPTIONS="${NODE_OPTIONS:-} --import ./scripts/preload-server-only.mjs"

echo "=== mctb-scale: outbox enqueue ==="
npx tsx scripts/mctb-scale/bench-outbox-enqueue.ts

echo "=== mctb-scale: inbound SMS burst ==="
npx tsx scripts/mctb-scale/bench-inbound-sms-burst.ts

echo "=== mctb-scale: redis memory probe ==="
npx tsx scripts/mctb-scale/bench-redis-memory-probe.ts

echo "=== mctb-scale: bullmq hardening smoke ==="
npx tsx scripts/bullmq-redis-hardening-smoke.ts

echo "=== mctb-scale: PASS (suite complete) ==="
