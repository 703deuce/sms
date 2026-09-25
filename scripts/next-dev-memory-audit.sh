#!/usr/bin/env bash
# Measurement-only helper for NEXT-DEV-14GB investigation. No app changes.
set -euo pipefail

LABEL="${1:-checkpoint}"
PORT="${NEXT_DEV_PORT:-3000}"

find_next_root_pid() {
  pgrep -f "next dev --port ${PORT}" 2>/dev/null | head -1 || pgrep -f "next dev" 2>/dev/null | head -1 || true
}

tree_rss_kb() {
  local root="$1"
  if [[ -z "$root" ]]; then echo 0; return; fi
  local total=0
  local pids
  pids=$(pstree -p "$root" 2>/dev/null | grep -oP '(\d+)' | sort -u || echo "$root")
  for pid in $pids; do
    if [[ -r "/proc/$pid/status" ]]; then
      local rss
      rss=$(awk '/^VmRSS:/ {print $2}' "/proc/$pid/status" 2>/dev/null || echo 0)
      total=$((total + rss))
    fi
  done
  echo "$total"
}

next_server_pid() {
  pgrep -f "next-server" 2>/dev/null | head -1 || true
}

du_next() {
  if [[ -d /workspace/.next ]]; then du -sb /workspace/.next 2>/dev/null | awk '{print $1}'; else echo 0; fi
}

du_cache() {
  if [[ -d /workspace/.next/dev/cache ]]; then du -sb /workspace/.next/dev/cache 2>/dev/null | awk '{print $1}'; else echo 0; fi
}

ROOT_PID=$(find_next_root_pid)
NS_PID=$(next_server_pid)
TREE_KB=$(tree_rss_kb "$ROOT_PID")
NS_KB=0
if [[ -n "$NS_PID" ]] && [[ -r "/proc/$NS_PID/status" ]]; then
  NS_KB=$(awk '/^VmRSS:/ {print $2}' "/proc/$NS_PID/status")
fi

NEXT_BYTES=$(du_next)
CACHE_BYTES=$(du_cache)
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

printf '%s\n' "--- $LABEL @ $TS ---"
printf 'next_dev_parent_pid=%s next_server_pid=%s\n' "${ROOT_PID:-none}" "${NS_PID:-none}"
printf 'process_tree_rss_mb=%.1f next_server_rss_mb=%.1f\n' "$(echo "$TREE_KB" | awk '{print $1/1024}')" "$(echo "$NS_KB" | awk '{print $1/1024}')"
printf '.next_bytes=%s .next_dev_cache_bytes=%s\n' "$NEXT_BYTES" "$CACHE_BYTES"
free -h | awk '/^Mem:/ {print "mem_total=" $2, "mem_used=" $3, "mem_avail=" $7}'
if [[ -n "$NS_PID" ]] && command -v curl >/dev/null; then
  # noop — heap via separate call if needed
  true
fi
