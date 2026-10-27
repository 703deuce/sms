#!/usr/bin/env bash
# LiveKit Agents 1.8.x: one @rtc_session per process; production runs V3 + optional clips captions.
set -euo pipefail

HEALTH_HTTP_PORT="${VOICE_WORKER_HTTP_PORT:-${VOICE_LEGACY_WORKER_HTTP_PORT:-8081}}"
CLIPS_HTTP_PORT="${CLIPS_WORKER_HTTP_PORT:-8083}"

# Explicit single-profile mode (local dev / debugging).
if [[ -n "${VOICE_WORKER_PROFILE:-}" ]]; then
  exec env VOICE_WORKER_HTTP_PORT="${VOICE_WORKER_HTTP_PORT:-$HEALTH_HTTP_PORT}" \
    VOICE_WORKER_PROFILE="${VOICE_WORKER_PROFILE}" \
    python -m transovo_voice.main start
fi

if [[ "${CLIPS_RECORDING_WORKER_ENABLED:-}" == "1" ]]; then
  echo "[transovo-voice] starting clips transcription http_port=${CLIPS_HTTP_PORT}"
  CLIPS_WORKER_HTTP_PORT="${CLIPS_HTTP_PORT}" \
    CLIPS_RECORDING_WORKER_ENABLED=1 \
    python -m transovo_voice.clips_transcription_main start &
  clips_pid=$!
  trap 'kill -TERM "$clips_pid" 2>/dev/null || true' EXIT INT TERM
  echo "[transovo-voice] clips transcription pid=${clips_pid}"
fi

echo "[transovo-voice] starting profile=v3 http_port=${HEALTH_HTTP_PORT}"
exec env VOICE_WORKER_PROFILE=v3 VOICE_WORKER_HTTP_PORT="${HEALTH_HTTP_PORT}" \
  python -m transovo_voice.main start
