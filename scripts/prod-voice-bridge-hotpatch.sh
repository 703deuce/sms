#!/usr/bin/env bash
# Hot-patch voice bridge into running web container (no Coolify build, not a master deploy).
#   ./scripts/prod-voice-bridge-hotpatch.sh                 # patch bridge files only
#   ./scripts/prod-voice-bridge-hotpatch.sh --config-only   # Amy Live prompt + bridge fixes
#   ./scripts/prod-voice-bridge-hotpatch.sh --minimal       # GPT-Live protocol baseline A (caller speaks first)
#   ./scripts/prod-voice-bridge-hotpatch.sh --live          # patch + openai_live + probes
#   ./scripts/prod-voice-bridge-hotpatch.sh --realtime      # patch + openai_realtime
set -euo pipefail

MODE="patch_only"
if [[ "${1:-}" == "--live" ]]; then MODE="live"; fi
if [[ "${1:-}" == "--realtime" ]]; then MODE="realtime"; fi
if [[ "${1:-}" == "--config-only" ]]; then MODE="config_only"; fi
if [[ "${1:-}" == "--minimal" ]]; then MODE="minimal"; fi

CONTAINER=$(ssh -o BatchMode=yes coolify-server 'docker ps --format "{{.Names}}" | grep ds8s3hjin | head -1')
if [[ -z "$CONTAINER" ]]; then echo "No web container" >&2; exit 1; fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAR="/tmp/voice-bridge-patch.tgz"
BRIDGE_FILES=(
  src/lib/voice/telnyx/openai-realtime-bridge/ws-server.ts
  src/lib/voice/telnyx/openai-realtime-bridge/call-bridge.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-call-bridge.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-config.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-bridge-diagnostics.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-minimal-call-bridge.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-minimal-config.ts
  src/lib/voice/telnyx/openai-realtime-bridge/ga-session.ts
  src/lib/voice/telnyx/openai-realtime-bridge/openai-realtime-protocol.ts
  src/lib/voice/telnyx/openai-realtime-bridge/flags.ts
  scripts/openai-realtime-test-a-minimal.ts
  scripts/smoke-realtime-bridge-openai.ts
  scripts/smoke-openai-live-bridge.ts
  scripts/probe-openai-live.ts
  scripts/probe-openai-live-session.ts
)

if [[ "$MODE" == "config_only" ]]; then
  tar czf "$TAR" -C "$ROOT" \
    src/lib/voice/telnyx/openai-realtime-bridge/live-config.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/live-call-bridge.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/live-bridge-diagnostics.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/live-minimal-call-bridge.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/live-minimal-config.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/ws-server.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/flags.ts
else
  tar czf "$TAR" -C "$ROOT" "${BRIDGE_FILES[@]}"
fi

scp -o BatchMode=yes "$TAR" "coolify-server:/tmp/voice-bridge-patch.tgz"

TRANSPORT_WRITE=""
if [[ "$MODE" == "live" ]]; then
  TRANSPORT_WRITE="echo openai_live > /app/.voice_ai_transport &&"
elif [[ "$MODE" == "minimal" ]]; then
  TRANSPORT_WRITE="echo openai_live_minimal > /app/.voice_ai_transport &&"
elif [[ "$MODE" == "realtime" ]]; then
  TRANSPORT_WRITE="echo openai_realtime > /app/.voice_ai_transport &&"
fi

ssh -o BatchMode=yes coolify-server "docker cp /tmp/voice-bridge-patch.tgz ${CONTAINER}:/tmp/voice-bridge-patch.tgz && docker exec ${CONTAINER} sh -c '${TRANSPORT_WRITE} cd /app && tar xzf /tmp/voice-bridge-patch.tgz' && docker restart ${CONTAINER}"

echo "Waiting for container..."
sleep 30

ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'curl -sf http://127.0.0.1:3000/api/health; echo'"

if [[ "$MODE" == "config_only" ]]; then
  echo "Patched Live config + bridge (inbound-only audio + diag trace). No master deploy. Call 571; grep openai_live_diag in container logs."
elif [[ "$MODE" == "minimal" ]]; then
  echo "GPT-Live MINIMAL baseline A active (openai_live_minimal). Caller speaks first. Logs: LIVE_CLIENT_EVENT / LIVE_SERVER_EVENT. See docs/OPENAI-LIVE-MINIMAL-BASELINE.md"
elif [[ "$MODE" == "live" ]]; then
  echo "--- Live probe (OpenAI only) ---"
  ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/probe-openai-live.ts'"
  echo "--- Live Telnyx smoke ---"
  ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/smoke-openai-live-bridge.ts'"
  echo "Set VOICE_AI_TRANSPORT=openai_live is active after restart. Call 571 to hear GPT-Live-1 Amy."
elif [[ "$MODE" == "realtime" ]]; then
  echo "--- Realtime Test A ---"
  ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && HOLD_MS=6000 NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/openai-realtime-test-a-minimal.ts'"
fi

echo "Container: ${CONTAINER}"
