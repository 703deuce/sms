#!/usr/bin/env bash
# Pass 3: probe with MEMORY_PROBE_* env on (app)/layout (temporary — removed after Pass 3; see git history).
# Usage: ./scripts/next-dev-memory-pass3-probe.sh <label> <env> <path>
# env: none | server-only | client-only
# Results: docs/NEXT-DEV-MEMORY-PASS-3-SERVER-VS-CLIENT.md
set -euo pipefail
LABEL="${1:?label}"
ENV_MODE="${2:?env}"
PATH_AFTER_AUTH="${3:?path}"
PORT=3000

case "$ENV_MODE" in
  none) EXPORT_ENV="" ;;
  server-only) EXPORT_ENV="MEMORY_PROBE_SERVER_ONLY=1" ;;
  client-only) EXPORT_ENV="MEMORY_PROBE_CLIENT_ONLY=1" ;;
  *) echo "unknown env mode: $ENV_MODE" >&2; exit 1 ;;
esac

kill_dev() {
  tmux -f /exec-daemon/tmux.portal.conf kill-session -t next-dev-memory-audit 2>/dev/null || true
  sleep 2
}

start_dev() {
  tmux -f /exec-daemon/tmux.portal.conf new-session -d -s next-dev-memory-audit -c /workspace \
    -- "DEV_AUTH_BYPASS=1 ${EXPORT_ENV} npm run dev -- --port ${PORT}"
  for _ in $(seq 1 40); do
    curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null && return 0
    sleep 2
  done
  echo "dev server failed to become ready" >&2
  exit 1
}

rss_mb() {
  local pid
  pid=$(pgrep -f "next-server" | head -1)
  if [[ -z "$pid" ]]; then echo 0; return; fi
  awk '/^VmRSS:/ {printf "%.1f", $2/1024}' "/proc/$pid/status"
}

cache_bytes() {
  if [[ -d /workspace/.next/dev/cache ]]; then
    du -sb /workspace/.next/dev/cache 2>/dev/null | awk '{print $1}'
  else echo 0; fi
}

next_bytes() {
  if [[ -d /workspace/.next ]]; then du -sb /workspace/.next 2>/dev/null | awk '{print $1}'; else echo 0; fi
}

kill_dev
rm -rf /workspace/.next
start_dev
sleep 8
echo "=== ${LABEL} env=${ENV_MODE} P0 === rss=$(rss_mb) next=$(next_bytes) cache=$(cache_bytes)"
sleep 60
echo "=== ${LABEL} P1 idle60 === rss=$(rss_mb)"
curl -sf -o /dev/null "http://127.0.0.1:${PORT}/api/health"
echo "=== ${LABEL} P2 health === rss=$(rss_mb)"
COOKIE=/tmp/transovo-audit-cookies.txt
rm -f "$COOKIE"
curl -sf -c "$COOKIE" -b "$COOKIE" -o /dev/null \
  "http://127.0.0.1:${PORT}/api/auth/dev-bypass?next=${PATH_AFTER_AUTH}"
START=$(date +%s%3N)
HTTP=$(curl -sf -b "$COOKIE" -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}${PATH_AFTER_AUTH}" || echo fail)
END=$(date +%s%3N)
echo "=== ${LABEL} P3 path=${PATH_AFTER_AUTH} http=${HTTP} ms=$((END-START)) rss=$(rss_mb) next=$(next_bytes) cache=$(cache_bytes)"
