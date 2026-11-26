#!/usr/bin/env bash
# launch.sh: render-first delivery for one LIVE job (Rick, Nov 19 2026).
#   bash launch.sh <J> <master.mp4> [--no-repack] [--window-hours 8] [--test-localhost]
# 1. foreground: upload the approved master MP4 + approveMaster (customer can play it now; job stays OPEN)
# 2. repack the live package into a few cache-friendly packs (repack-live.mjs; skipped with --no-repack)
# 3. detached (setsid nohup): watchdog.sh -> deliver-editable.mjs uploads the editable version,
#    publishes it and calls /complete {delivery:"live"}. Survives the agent's turn ending.
# Needs: <J>/editable/live/payload/live.json from `publish-live.mjs --dry-run` (PASS), <J>/secrets/{job_url,token}.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
J="$(cd "$1" && pwd)"; MASTER="$(realpath "$2")"; shift 2
REPACK=1; WINDOW=8; TEST=false
while [ $# -gt 0 ]; do case "$1" in
  --no-repack) REPACK=0;; --window-hours) WINDOW="$2"; shift;; --test-localhost) TEST=true;;
  *) echo "unknown option $1" >&2; exit 2;; esac; shift; done
LIVE="$J/editable/live"; BG="$J/deliver_bg"
[ -f "$LIVE/payload/live.json" ] || { echo "missing $LIVE/payload/live.json (run publish-live.mjs --dry-run first; it must PASS)" >&2; exit 2; }
mkdir -p "$BG"; chmod 700 "$BG"
if [ -f "$BG/DONE" ]; then echo "already delivered: $(cat "$BG/DONE")"; exit 0; fi
PKG="$LIVE/payload/live.json"
if [ "$REPACK" = 1 ]; then
  node "$HERE/repack-live.mjs" --live-dir "$LIVE" > "$BG/repack.log" 2>&1 && PKG="$LIVE/payload/live.packed.json" \
    || echo "repack failed (see $BG/repack.log); uploading the unpacked package instead" >&2
fi
DUR=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).durationMs)' "$PKG")
node -e '
const fs=require("fs"); const [bg,live,pkg,dur,win,test]=process.argv.slice(1);
fs.writeFileSync(bg+"/config.json", JSON.stringify({liveDir:live,packageFile:pkg,durationMs:Number(dur),retryWindowHours:Number(win),
  concurrency:8,testLocalhost:test==="true",createdAt:new Date().toISOString()},null,1));' "$BG" "$LIVE" "$PKG" "$DUR" "$WINDOW" "$TEST"
# step 1 (foreground): the customer can play the MP4 when this returns 0
node "$HERE/deliver-master.mjs" --job-dir "$J" --master "$MASTER"
# step 2 (background, detached from this shell and the agent's turn)
bash "$HERE/start-watchdog.sh" "$J"
echo "editable delivery running in the background: status $BG/status.json, log $BG/worker.log"
