#!/usr/bin/env bash
# Enable GPT-Live baseline on production test container (571 PSTN). No master deploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Hot-patch bridge + set transport openai_live"
./scripts/prod-voice-bridge-hotpatch.sh --live

CONTAINER=$(ssh -o BatchMode=yes coolify-server 'docker ps --format "{{.Names}}" | grep ds8s3hjin | head -1')
echo "==> Republish 571 Call Control + media bridge routing"
ssh -o BatchMode=yes coolify-server "docker exec ${CONTAINER} sh -c 'cd /app && NODE_OPTIONS=\"--import ./scripts/preload-server-only.mjs\" npx tsx scripts/republish-openai-realtime-bridge-agent.ts'"

echo ""
echo "READY — call +1 571-407-3615"
echo "  Transport: openai_live (see /app/.voice_ai_transport)"
echo "  Baseline: OPENAI_LIVE_BASELINE=A (default) — you speak first; 10s silence test"
echo "  Optional: OPENAI_LIVE_BASELINE=B for one-line assistant copy"
echo "  Logs: docker logs -f ${CONTAINER} 2>&1 | grep -E 'LIVE_OUT|LIVE_IN|LIVE_STATS|telnyx_media_ws_connected'"
