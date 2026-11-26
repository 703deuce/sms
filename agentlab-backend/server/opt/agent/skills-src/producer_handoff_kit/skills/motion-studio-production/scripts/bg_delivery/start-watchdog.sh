#!/usr/bin/env bash
# start-watchdog.sh <J>: start the per-job watchdog detached (no-op if one already holds the lock).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; J="$(cd "$1" && pwd)"; BG="$J/deliver_bg"
[ -f "$BG/config.json" ] || { echo "no $BG/config.json" >&2; exit 2; }
if [ -f "$BG/DONE" ] || [ -f "$BG/FAILED" ]; then echo "terminal: $(ls "$BG" | grep -E '^(DONE|FAILED)$')"; exit 0; fi
if ! flock -n "$BG/watchdog.lock" true; then echo "watchdog already running for $J"; exit 0; fi
setsid nohup bash "$HERE/watchdog.sh" "$J" >> "$BG/watchdog.log" 2>&1 < /dev/null &
echo $! > "$BG/watchdog.pid"
echo "watchdog started (pid $(cat "$BG/watchdog.pid"))"
