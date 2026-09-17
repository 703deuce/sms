#!/usr/bin/env bash
# Hot-patch voice bridge + Voice V2 interpreter into running web container (no Coolify build).
#   ./scripts/prod-voice-bridge-hotpatch.sh                 # patch sources only
#   ./scripts/prod-voice-bridge-hotpatch.sh --config-only   # Live config + lean inbound files
#   ./scripts/prod-voice-bridge-hotpatch.sh --live          # patch + openai_live + probes
#   ./scripts/prod-voice-bridge-hotpatch.sh --realtime      # patch + openai_realtime
#
# Prefer: ./scripts/test-pstn-before-master.sh (hotpatch + Astra file + republish 571).
#
# GPT-Live uses transport openai_live (.voice_ai_transport). Bridge WSS loads /app/src via tsx.
# Telnyx webhooks still use .next/standalone — run prod-gpt-live-rebuild-web.sh only if inbound changed.
set -euo pipefail

MODE="patch_only"
if [[ "${1:-}" == "--live" ]]; then MODE="live"; fi
if [[ "${1:-}" == "--realtime" ]]; then MODE="realtime"; fi
if [[ "${1:-}" == "--config-only" ]]; then MODE="config_only"; fi

CONTAINER=$(ssh -o BatchMode=yes coolify-server 'docker ps --format "{{.Names}}" | grep ds8s3hjin | head -1')
if [[ -z "$CONTAINER" ]]; then echo "No web container" >&2; exit 1; fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAR="/tmp/voice-bridge-patch.tgz"

# Whole trees: GPT-Live bridge + Voice V2 (interpreter, merge, FIND/BOOK executors).
BRIDGE_FILES=(
  src/lib/ai/openai.ts
  src/lib/voice/telnyx/openai-live-bridge
  src/lib/voice-v2
  src/lib/voice/telnyx/openai-realtime-bridge/public-flags.ts
  src/lib/voice/telnyx/openai-realtime-bridge/apply-bridge-config.ts
  src/lib/voice/telnyx/openai-realtime-bridge/flags.ts
  src/lib/voice/telnyx/openai-realtime-bridge/gpt-live-pstn-lean-answer.ts
  src/lib/voice/telnyx/openai-realtime-bridge/ws-server.ts
  src/lib/voice/telnyx/openai-realtime-bridge/call-bridge.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-call-bridge.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-minimal-bridge.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-config.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-frontend-instructions.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-greeting.ts
  src/lib/voice/telnyx/openai-realtime-bridge/live-bridge-diagnostics.ts
  src/lib/voice/telnyx/openai-realtime-bridge/ga-session.ts
  src/lib/voice/telnyx/openai-realtime-bridge/openai-realtime-protocol.ts
  src/lib/voice/telnyx/openai-realtime-bridge/start-on-call.ts
  src/lib/voice/telnyx/openai-realtime-bridge/config.ts
  src/lib/voice/telnyx/openai-realtime-bridge/stream-token.ts
  src/lib/voice/telnyx/openai-realtime-bridge/telnyx-streaming.ts
  src/lib/voice/telnyx/webhook-handlers.ts
  src/lib/voice/inbound.ts
  src/lib/voice/calendar/resolve-datetime.ts
  scripts/realtime-bridge-listener.ts
  scripts/openai-realtime-test-a-minimal.ts
  scripts/smoke-realtime-bridge-openai.ts
  scripts/smoke-openai-live-bridge.ts
  scripts/probe-openai-live.ts
  scripts/probe-openai-live-session.ts
  scripts/republish-openai-realtime-bridge-agent.ts
)

if [[ "$MODE" == "config_only" ]]; then
  tar czf "$TAR" -C "$ROOT" \
    src/lib/voice/telnyx/openai-realtime-bridge/live-config.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/live-frontend-instructions.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/live-greeting.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/live-call-bridge.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/live-minimal-bridge.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/live-bridge-diagnostics.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/public-flags.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/apply-bridge-config.ts \
    src/lib/voice/telnyx/openai-live-bridge \
    src/lib/voice-v2/session/call-context-store.ts \
    src/lib/voice-v2/dialog-goal.ts \
    src/lib/voice-v2/dialog-manager.ts \
    src/lib/voice-v2/caller-intent-interpreter.ts \
    src/lib/voice-v2/booking-workflow.ts \
    src/lib/voice-v2/booking-workflow-hooks.ts \
    src/lib/voice-v2/intake/types.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/ws-server.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/flags.ts \
    src/lib/voice/telnyx/openai-realtime-bridge/start-on-call.ts \
    src/lib/voice/telnyx/webhook-handlers.ts \
    src/lib/voice/inbound.ts
else
  tar czf "$TAR" -C "$ROOT" "${BRIDGE_FILES[@]}"
fi

scp -o BatchMode=yes "$TAR" "coolify-server:/tmp/voice-bridge-patch.tgz"

TRANSPORT_WRITE=""
if [[ "$MODE" == "live" ]]; then
  TRANSPORT_WRITE="echo openai_live > /app/.voice_ai_transport && echo 1 > /app/.openai_live_delegation &&"
elif [[ "$MODE" == "realtime" ]]; then
  TRANSPORT_WRITE="echo openai_realtime > /app/.voice_ai_transport &&"
fi

ssh -o BatchMode=yes coolify-server "docker cp /tmp/voice-bridge-patch.tgz ${CONTAINER}:/tmp/voice-bridge-patch.tgz && docker exec ${CONTAINER} sh -c '${TRANSPORT_WRITE} cd /app && tar xzf /tmp/voice-bridge-patch.tgz' && docker restart ${CONTAINER}"

echo "Waiting for container..."
sleep 30

ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'curl -sf http://127.0.0.1:3000/api/health; echo'"

if [[ "$MODE" == "config_only" ]]; then
  echo "Patched Live config + bridge. Default OPENAI_LIVE_BASELINE=G (greeting + behavioral frontend). No master deploy."
elif [[ "$MODE" == "live" ]]; then
  echo "--- Live probe (OpenAI only) ---"
  ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/probe-openai-live.ts'" || true
  echo "--- Live Telnyx smoke ---"
  ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/smoke-openai-live-bridge.ts'" || true
  echo "openai_live active on +1 571-407-3615. Baseline A (default): caller speaks first. Logs: LIVE_OUT / LIVE_IN / LIVE_STATS"
elif [[ "$MODE" == "realtime" ]]; then
  echo "--- Realtime Test A ---"
  ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && HOLD_MS=6000 NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/openai-realtime-test-a-minimal.ts'"
fi

echo "Container: ${CONTAINER}"
