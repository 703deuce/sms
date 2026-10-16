#!/usr/bin/env bash
# Voice V3 only — legacy LiveKit template worker removed (no livekit_basic_voice fallback).
set -euo pipefail

HTTP_PORT="${VOICE_WORKER_HTTP_PORT:-${VOICE_LEGACY_WORKER_HTTP_PORT:-8081}}"

echo "[transovo-voice] starting Voice V3 worker only http_port=${HTTP_PORT}"

exec env \
  VOICE_WORKER_PROFILE=v3 \
  VOICE_WORKER_HTTP_PORT="${HTTP_PORT}" \
  LIVEKIT_AGENT_NAME="${VOICE_V3_LIVEKIT_AGENT_NAME:-transovo-voice-v3}" \
  python -m transovo_voice.main start
