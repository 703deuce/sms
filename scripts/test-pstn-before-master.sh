#!/usr/bin/env bash
# PSTN test on production (+1 571-407-3615) without waiting for Coolify master build.
#
# Copies current workspace src into the running web container, sets openai_live transport,
# enables Astra interpreter via /app/.voice_v2_astra_interpreter, republishes Call Control routing.
#
# Usage:
#   ./scripts/test-pstn-before-master.sh
#   ENABLE_ASTRA=0 ./scripts/test-pstn-before-master.sh   # deterministic interpreter only
#   SKIP_REPUBLISH=1 ./scripts/test-pstn-before-master.sh
#
# Inbound/webhook-only changes still need: ./scripts/prod-gpt-live-rebuild-web.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENABLE_ASTRA="${ENABLE_ASTRA:-1}"
SKIP_REPUBLISH="${SKIP_REPUBLISH:-0}"

echo "==> Hot-patch GPT-Live + Voice V2 interpreter (no Coolify build)"
./scripts/prod-voice-bridge-hotpatch.sh --live

CONTAINER=$(ssh -o BatchMode=yes coolify-server 'docker ps --format "{{.Names}}" | grep ds8s3hjin | head -1')
if [[ -z "$CONTAINER" ]]; then echo "No web container" >&2; exit 1; fi

if [[ "$ENABLE_ASTRA" == "1" ]]; then
  echo "==> Enable Astra caller interpreter (/app/.voice_v2_astra_interpreter)"
  ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'echo 1 > /app/.voice_v2_astra_interpreter'"
else
  echo "==> Astra off (deterministic interpreter)"
  ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'echo 0 > /app/.voice_v2_astra_interpreter'"
fi

if [[ "$SKIP_REPUBLISH" != "1" ]]; then
  echo "==> Republish 571 Call Control + media bridge routing"
  ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/republish-openai-realtime-bridge-agent.ts'"
fi

HEALTH=$(ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'curl -sf http://127.0.0.1:3000/api/health'" || true)
echo ""
echo "READY — call +1 571-407-3615"
echo "  Transport: openai_live (/app/.voice_ai_transport)"
echo "  Interpreter: Astra=${ENABLE_ASTRA} (/app/.voice_v2_astra_interpreter)"
echo "  Health: ${HEALTH:-unavailable}"
echo "  Logs: ssh coolify-server \"docker logs -f ${CONTAINER} 2>&1 | grep -E 'LIVE_|CALLER_UTTERANCE|ASTRA_|interpretStable'\""
echo ""
echo "Note: /api/health commitSha may still show the last Coolify image; bridge code runs from patched /app/src."
