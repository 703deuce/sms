#!/usr/bin/env bash
# Pass 4 attribution probes. Usage: ./scripts/next-dev-memory-pass4-probe.sh <label> <probe-env> <path>
# probe-env: base | segment | auth | appshell-module | appshell-render | workspace-data-module |
#            workspace-data-execute | outcomes-registry-module | outcomes-execute
# base: no MEMORY_PASS4_PROBE (public route outside (app))
# others: MEMORY_PASS4_PROBE=<id> for (app) layout branch
set -euo pipefail
LABEL="${1:?label}"
PROBE="${2:?probe}"
PATH_PROBE="${3:?path}"
PORT=3000

if [[ "$PROBE" == "base" ]]; then
  EXPORT_ENV=""
else
  EXPORT_ENV="MEMORY_PASS4_PROBE=${PROBE}"
fi

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
echo "=== ${LABEL} probe=${PROBE} P0 === rss=$(rss_mb) next=$(next_bytes) cache=$(cache_bytes)"
sleep 60
echo "=== ${LABEL} P1 idle60 === rss=$(rss_mb)"
curl -sf -o /dev/null "http://127.0.0.1:${PORT}/api/health"
echo "=== ${LABEL} P2 health === rss=$(rss_mb)"
COOKIE=/tmp/transovo-audit-cookies.txt
rm -f "$COOKIE"
curl -sf -c "$COOKIE" -b "$COOKIE" -o /dev/null \
  "http://127.0.0.1:${PORT}/api/auth/dev-bypass?next=${PATH_PROBE}"
START=$(date +%s%3N)
HTTP=$(curl -sf -b "$COOKIE" -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}${PATH_PROBE}" || echo fail)
END=$(date +%s%3N)
echo "=== ${LABEL} P3 path=${PATH_PROBE} http=${HTTP} ms=$((END-START)) rss=$(rss_mb) next=$(next_bytes) cache=$(cache_bytes)"
