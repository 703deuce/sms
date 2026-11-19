#!/usr/bin/env bash
# resume-all.sh [ROOT...]: restart the watchdog for every unfinished background delivery.
# Safe to run any time and as often as you like (each job's watchdog holds a lock).
# This box has no cron/systemd, so run it at the start of every Motion Studio job/routine run and after any box restart.
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOTS=("$@"); [ ${#ROOTS[@]} -eq 0 ] && ROOTS=(/workspace/motion_jobs)
for root in "${ROOTS[@]}"; do
  for bg in "$root"/*/deliver_bg; do
    [ -f "$bg/config.json" ] || continue
    J="$(dirname "$bg")"
    if [ -f "$bg/DONE" ]; then continue; fi
    if [ -f "$bg/FAILED" ]; then echo "FAILED: $J -> $(head -1 "$bg/FAILED")"; continue; fi
    bash "$HERE/start-watchdog.sh" "$J"
  done
done
