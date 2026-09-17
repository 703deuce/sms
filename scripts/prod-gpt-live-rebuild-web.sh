#!/usr/bin/env bash
# Rebuild Next standalone on the production web container so Telnyx webhooks pick up
# src changes (hot-patching src/ alone does NOT update .next/standalone).
set -euo pipefail

CONTAINER=$(ssh -o BatchMode=yes coolify-server 'docker ps --format "{{.Names}}" | grep ds8s3hjin | head -1')
if [[ -z "$CONTAINER" ]]; then echo "No web container" >&2; exit 1; fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAR="/tmp/gpt-live-web-src.tgz"
tar czf "$TAR" -C "$ROOT" \
  src/lib/voice/inbound.ts \
  src/lib/voice/telnyx/openai-realtime-bridge/flags.ts \
  src/lib/voice/telnyx/openai-realtime-bridge/gpt-live-pstn-lean-answer.ts \
  src/lib/voice/telnyx/openai-realtime-bridge/live-greeting.ts \
  src/lib/voice/telnyx/openai-realtime-bridge/live-minimal-bridge.ts \
  src/lib/voice/telnyx/openai-realtime-bridge/live-config.ts \
  src/lib/voice/telnyx/openai-realtime-bridge/live-call-bridge.ts \
  src/lib/voice/telnyx/openai-realtime-bridge/start-on-call.ts \
  src/lib/solutions/appointment-receptionist/build-agent-config.ts

scp -o BatchMode=yes "$TAR" "coolify-server:/tmp/gpt-live-web-src.tgz"
ssh -o BatchMode=yes coolify-server "docker cp /tmp/gpt-live-web-src.tgz ${CONTAINER}:/tmp/gpt-live-web-src.tgz && docker exec ${CONTAINER} sh -c 'cd /app && tar xzf /tmp/gpt-live-web-src.tgz && echo openai_live > /app/.voice_ai_transport'"

echo "Building Next standalone inside container (several minutes)..."
ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && npm run build'"
ssh -o BatchMode=yes coolify-server "docker restart ${CONTAINER}"

echo "Waiting for health..."
sleep 45
ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'curl -sf http://127.0.0.1:3000/api/health; echo'"

echo "Done. Webhooks now use rebuilt inbound + GPT-Live lean answer path."
