#!/usr/bin/env bash
# Apply GA realtime bridge sources into the RUNNING web container (no Coolify build).
# Usage (from repo root on a machine with SSH to Coolify):
#   ./scripts/prod-realtime-bridge-hotpatch-and-test.sh [container_name]
set -euo pipefail

CONTAINER="${1:-}"
if [[ -z "$CONTAINER" ]]; then
  CONTAINER=$(ssh -o BatchMode=yes coolify-server 'docker ps --format "{{.Names}}" | grep ds8s3hjin | head -1')
fi
if [[ -z "$CONTAINER" ]]; then
  echo "No web container found" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAR="/tmp/rt-ga-patch.tgz"
tar czf "$TAR" -C "$ROOT" \
  src/lib/voice/telnyx/openai-realtime-bridge/call-bridge.ts \
  src/lib/voice/telnyx/openai-realtime-bridge/ga-session.ts \
  src/lib/voice/telnyx/openai-realtime-bridge/openai-realtime-protocol.ts \
  src/lib/voice/telnyx/openai-realtime-bridge/flags.ts \
  scripts/openai-realtime-test-a-minimal.ts \
  scripts/smoke-realtime-bridge-openai.ts \
  scripts/probe-openai-live-session.ts

scp -o BatchMode=yes "$TAR" "coolify-server:/tmp/rt-ga-patch.tgz"
ssh -o BatchMode=yes coolify-server "docker cp /tmp/rt-ga-patch.tgz ${CONTAINER}:/tmp/rt-ga-patch.tgz && docker exec ${CONTAINER} sh -c 'cd /app && tar xzf /tmp/rt-ga-patch.tgz && echo patched_ok beta_refs=\$(grep -c OpenAI-Beta src/lib/voice/telnyx/openai-realtime-bridge/call-bridge.ts || true)' && docker restart ${CONTAINER}"

echo "Waiting for container..."
sleep 28

ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'curl -sf http://127.0.0.1:3000/api/health | head -c 200; echo'"

echo "--- Test A (OpenAI only) ---"
ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && HOLD_MS=6000 NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/openai-realtime-test-a-minimal.ts'"

echo "--- Test B (Telnyx media WS smoke) ---"
ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/smoke-realtime-bridge-openai.ts'"

echo "Done. Place a PSTN test call to 571 when both tests pass."
