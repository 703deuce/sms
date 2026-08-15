#!/usr/bin/env bash
# Keep Coolify build logs alive during long silent next build phases.
# Validates output so hidden OOM kills (exit 0, missing .next) fail loudly.
set -euo pipefail

heartbeat_interval="${COOLIFY_BUILD_HEARTBEAT_SECS:-20}"

echo "[coolify-build] starting next production build (turbopack default)"
echo "[coolify-build] node=$(node -v) heap_limit=${NODE_OPTIONS:-unset}"

set -o pipefail
npm run build > >(stdbuf -oL -eL tee /tmp/coolify-next-build.log) 2>&1 &
build_pid=$!

while kill -0 "$build_pid" 2>/dev/null; do
  sleep "$heartbeat_interval"
  if kill -0 "$build_pid" 2>/dev/null; then
    mem_kb="$(awk '/VmRSS/ {print $2; exit}' "/proc/$build_pid/status" 2>/dev/null || echo "?")"
    echo "[coolify-build] still running... pid=$build_pid rss_kb=${mem_kb}"
  fi
done

wait "$build_pid"
build_status=$?

if [[ "$build_status" -ne 0 ]]; then
  echo "[coolify-build] next build exited with status $build_status"
  if [[ "$build_status" -eq 137 ]]; then
    echo "[coolify-build] exit 137: process likely OOM-killed — raise VM RAM or lower NODE_OPTIONS heap"
  fi
  exit "$build_status"
fi

if [[ ! -d .next/server ]]; then
  echo "[coolify-build] build reported success but .next/server is missing (hidden OOM?)"
  tail -n 40 /tmp/coolify-next-build.log 2>/dev/null || true
  exit 1
fi

if [[ ! -f .next/standalone/server.js ]]; then
  echo "[coolify-build] standalone output missing at .next/standalone/server.js"
  exit 1
fi

echo "[coolify-build] complete"
