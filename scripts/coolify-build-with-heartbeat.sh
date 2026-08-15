#!/usr/bin/env bash
# Keep Coolify build logs alive during long silent next build phases.
set -euo pipefail

echo "[coolify-build] starting npm run build (webpack)"
npm run build &
build_pid=$!

while kill -0 "$build_pid" 2>/dev/null; do
  sleep 45
  if kill -0 "$build_pid" 2>/dev/null; then
    echo "[coolify-build] still running..."
  fi
done

wait "$build_pid"
echo "[coolify-build] complete"
