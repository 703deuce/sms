#!/usr/bin/env bash
# watchdog.sh <J>: keeps deliver-editable.mjs running until DONE or FAILED. One per job (flock).
# A crash or kill of the worker -> restart after a short pause. Resume comes from state.json + server receipts.
HERE="$(cd "$(dirname "$0")" && pwd)"; J="$1"; BG="$J/deliver_bg"
exec 9>"$BG/watchdog.lock"; flock -n 9 || exit 0
echo $$ > "$BG/watchdog.pid"
n=0
while [ ! -f "$BG/DONE" ] && [ ! -f "$BG/FAILED" ]; do
  n=$((n+1)); echo "$(date '+%F %T %Z') watchdog: starting worker (run $n)"
  # the worker inherits fd 9, so the lock stays held while a worker lives even if this loop is killed
  node --experimental-strip-types --no-warnings "$HERE/deliver-editable.mjs" --job-dir "$J"; rc=$?
  echo "$(date '+%F %T %Z') watchdog: worker exited rc=$rc"
  [ $rc -eq 0 ] && break
  [ $rc -eq 3 ] && break
  sleep "${BG_DELIVERY_RESTART_SEC:-15}"
done
rm -f "$BG/watchdog.pid"
