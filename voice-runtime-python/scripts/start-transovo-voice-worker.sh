#!/usr/bin/env bash
# Production entry: LiveKit Agents 1.8.x allows one @rtc_session per process.
# Default: two processes in one container (legacy + VOICE_V3_LIVEKIT_AGENT_NAME).
set -euo pipefail

run_profile() {
  local profile="$1"
  echo "[transovo-voice] starting profile=${profile}"
  VOICE_WORKER_PROFILE="${profile}" python -m transovo_voice.main start
}

if [[ "${VOICE_ENABLE_V3_PROFILE:-1}" == "1" ]] && [[ -z "${VOICE_WORKER_PROFILE:-}" ]]; then
  run_profile "legacy" &
  legacy_pid=$!
  run_profile "v3" &
  v3_pid=$!
  wait -n "$legacy_pid" "$v3_pid"
  exit $?
fi

exec env VOICE_WORKER_PROFILE="${VOICE_WORKER_PROFILE:-legacy}" python -m transovo_voice.main start
