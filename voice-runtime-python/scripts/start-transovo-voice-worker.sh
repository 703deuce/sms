#!/usr/bin/env bash
# LiveKit Agents: Voice V3 only (legacy transovo-voice-runtime removed from main.py).
set -euo pipefail

HEALTH_HTTP_PORT="${VOICE_WORKER_HTTP_PORT:-${VOICE_LEGACY_WORKER_HTTP_PORT:-8081}}"

# Explicit single-profile mode (local dev / debugging).
if [[ -n "${VOICE_WORKER_PROFILE:-}" ]]; then
  exec env VOICE_WORKER_HTTP_PORT="${VOICE_WORKER_HTTP_PORT:-$HEALTH_HTTP_PORT}" \
    VOICE_WORKER_PROFILE="${VOICE_WORKER_PROFILE}" \
    python -m transovo_voice.main start
fi

# Production: one V3 worker on 8081 (Coolify healthcheck + Dockerfile HEALTHCHECK).
echo "[transovo-voice] starting profile=v3 http_port=${HEALTH_HTTP_PORT}"
exec env VOICE_WORKER_PROFILE=v3 VOICE_WORKER_HTTP_PORT="${HEALTH_HTTP_PORT}" \
  python -m transovo_voice.main start
