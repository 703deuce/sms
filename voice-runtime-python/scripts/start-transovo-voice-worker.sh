#!/usr/bin/env bash
# LiveKit Agents 1.8.x: one @rtc_session per process; App 2 runs legacy + V3 in one container.
set -euo pipefail

LEGACY_HTTP_PORT="${VOICE_LEGACY_WORKER_HTTP_PORT:-8081}"
V3_HTTP_PORT="${VOICE_V3_WORKER_HTTP_PORT:-8083}"

run_profile() {
  local profile="$1"
  local http_port="$2"
  echo "[transovo-voice] starting profile=${profile} http_port=${http_port}"
  VOICE_WORKER_PROFILE="${profile}" \
    VOICE_WORKER_HTTP_PORT="${http_port}" \
    python -m transovo_voice.main start
}

terminate_children() {
  local pid
  for pid in "${child_pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
}

wait_for_children() {
  local status=0
  local pid
  for pid in "${child_pids[@]}"; do
    if ! wait "$pid"; then
      status=1
    fi
  done
  return "$status"
}

# Explicit single-profile mode (local dev / debugging).
if [[ -n "${VOICE_WORKER_PROFILE:-}" ]]; then
  exec env VOICE_WORKER_HTTP_PORT="${VOICE_WORKER_HTTP_PORT:-$LEGACY_HTTP_PORT}" \
    VOICE_WORKER_PROFILE="${VOICE_WORKER_PROFILE}" \
    python -m transovo_voice.main start
fi

# Legacy-only escape hatch (Coolify health stays on 8081).
if [[ "${VOICE_ENABLE_V3_PROFILE:-1}" != "1" ]]; then
  exec env VOICE_WORKER_PROFILE=legacy VOICE_WORKER_HTTP_PORT="${LEGACY_HTTP_PORT}" \
    python -m transovo_voice.main start
fi

child_pids=()
run_profile "legacy" "$LEGACY_HTTP_PORT" &
child_pids+=("$!")
run_profile "v3" "$V3_HTTP_PORT" &
child_pids+=("$!")

trap 'echo "[transovo-voice] signal — stopping children"; terminate_children; wait_for_children; exit 0' SIGTERM SIGINT

# Fail fast if a child dies during bootstrap.
sleep 3
for pid in "${child_pids[@]}"; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "[transovo-voice] worker pid=${pid} exited during startup"
    terminate_children
    wait_for_children || true
    exit 1
  fi
done

echo "[transovo-voice] dual workers running pids=${child_pids[*]}"

# Block until any child exits (container should restart).
wait -n "${child_pids[0]}" "${child_pids[1]}"
exit_code=$?
echo "[transovo-voice] a worker exited (code=${exit_code}); stopping sibling"
terminate_children
wait_for_children || true
exit "$exit_code"
