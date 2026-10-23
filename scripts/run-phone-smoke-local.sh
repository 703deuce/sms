#!/usr/bin/env bash
# Start new-app locally (if not already listening) and run test:phone smoke scripts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/new-app"
PORT="${UI_AGENT_BASE_URL_PORT:-3100}"
export DEV_AUTH_BYPASS="${DEV_AUTH_BYPASS:-1}"

if ! curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "Starting new-app on port ${PORT}..."
  cd "$APP"
  if [[ ! -d node_modules ]]; then
    npm ci
  fi
  PORT="$PORT" npm run dev &
  DEV_PID=$!
  for i in $(seq 1 60); do
    if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  if ! curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    echo "FAIL: dev server did not become healthy on :${PORT}"
    echo "Requires DATABASE_URL and other env from .env — set them in the Cloud Agent environment."
    kill "$DEV_PID" 2>/dev/null || true
    exit 1
  fi
  export UI_AGENT_BASE_URL="http://127.0.0.1:${PORT}"
  cd "$APP"
  npm run test:phone
  kill "$DEV_PID" 2>/dev/null || true
else
  export UI_AGENT_BASE_URL="${UI_AGENT_BASE_URL:-http://127.0.0.1:${PORT}}"
  cd "$APP"
  npm run test:phone
fi
