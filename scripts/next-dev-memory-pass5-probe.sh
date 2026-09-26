#!/usr/bin/env bash
# Pass 5: framework / segment attribution
# Usage: ./scripts/next-dev-memory-pass5-probe.sh <label> <root-mode> <target> [bundler]
#   root-mode: bare | globals | jakarta | geist | brand | full
#   target: public | segment  (segment sets MEMORY_PASS5_SEGMENT=1, path in (app))
#   bundler: turbo (default) | webpack
set -euo pipefail
LABEL="${1:?label}"
ROOT_MODE="${2:?root-mode}"
TARGET="${3:?target}"
BUNDLER="${4:-turbo}"
PORT=3000

case "$TARGET" in
  public)
    PATH_PROBE="/dev/memory-pass5-public"
    SEGMENT_ENV=""
    ;;
  segment)
    PATH_PROBE="/dev/memory-pass5-app"
    SEGMENT_ENV="MEMORY_PASS5_SEGMENT=1"
    ;;
  *)
    echo "unknown target: $TARGET" >&2
    exit 1
    ;;
esac

DEV_FLAGS="--port ${PORT}"
if [[ "$BUNDLER" == "webpack" ]]; then
  DEV_FLAGS="--webpack ${DEV_FLAGS}"
fi

kill_dev() {
  tmux -f /exec-daemon/tmux.portal.conf kill-session -t next-dev-memory-audit 2>/dev/null || true
  sleep 2
}

start_dev() {
  tmux -f /exec-daemon/tmux.portal.conf new-session -d -s next-dev-memory-audit -c /workspace \
    -- "DEV_AUTH_BYPASS=1 MEMORY_PASS5_ROOT=${ROOT_MODE} ${SEGMENT_ENV} npm run dev -- ${DEV_FLAGS}"
  for _ in $(seq 1 40); do
    curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null && return 0
    sleep 2
  done
  echo "dev server failed to become ready" >&2
  exit 1
}

rss_mb_pid() {
  awk '/^VmRSS:/ {printf "%.1f", $2/1024}' "/proc/$1/status" 2>/dev/null || echo 0
}

rss_next_server_mb() {
  local pid
  pid=$(pgrep -f "next-server" | head -1)
  if [[ -z "$pid" ]]; then echo 0; return; fi
  rss_mb_pid "$pid"
}

# Sum RSS for node/next-related processes (dev parent, next-server, turbopack workers)
process_tree_rss_mb() {
  local sum=0
  local pid rss
  while read -r pid; do
    [[ -z "$pid" ]] && continue
    rss=$(rss_mb_pid "$pid")
    sum=$(awk -v a="$sum" -v b="$rss" 'BEGIN{printf "%.1f", a+b}')
  done < <(pgrep -f "next dev|next-server|turbopack-node|\\.next" 2>/dev/null | sort -u)
  echo "$sum"
}

process_tree_detail() {
  echo "--- process tree (pid rss_mb comm) ---"
  local pid rss comm
  for pid in $(pgrep -f "next dev|next-server|turbopack|node.*next" 2>/dev/null | sort -u); do
    rss=$(rss_mb_pid "$pid")
    comm=$(ps -p "$pid" -o comm= 2>/dev/null | tr -d ' ')
    echo "pid=${pid} rss_mb=${rss} comm=${comm}"
  done
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
echo "=== ${LABEL} root=${ROOT_MODE} target=${TARGET} bundler=${BUNDLER} P0 === next-server=$(rss_next_server_mb) tree=$(process_tree_rss_mb) next=$(next_bytes) cache=$(cache_bytes)"
sleep 60
echo "=== ${LABEL} P1 idle60 next-server=$(rss_next_server_mb) tree=$(process_tree_rss_mb)"
curl -sf -o /dev/null "http://127.0.0.1:${PORT}/api/health"
echo "=== ${LABEL} P2 health next-server=$(rss_next_server_mb) tree=$(process_tree_rss_mb)"
COOKIE=/tmp/transovo-audit-cookies.txt
rm -f "$COOKIE"
curl -sf -c "$COOKIE" -b "$COOKIE" -o /dev/null \
  "http://127.0.0.1:${PORT}/api/auth/dev-bypass?next=${PATH_PROBE}"
START=$(date +%s%3N)
HTTP=$(curl -sf -b "$COOKIE" -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}${PATH_PROBE}" || echo fail)
END=$(date +%s%3N)
echo "=== ${LABEL} P3 path=${PATH_PROBE} http=${HTTP} ms=$((END-START)) next-server=$(rss_next_server_mb) tree=$(process_tree_rss_mb) next=$(next_bytes) cache=$(cache_bytes)"
process_tree_detail
