#!/usr/bin/env bash
# Explicitly selected legacy Modal submission; unchanged backend and budget guards.
set +x; set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib_env.sh"
J="$(cd "${1:?job directory missing}" && pwd)"
MODE="${2:-cpu}"
case "$MODE" in cpu|gpu) ;; *) exit 2;; esac
[ "${MODAL_DISABLED:-0}" != 1 ] && [ ! -f "$HERE/.modal_disabled" ] ||
  { echo "Modal disabled" >&2; exit 4; }
load_job_env "$J"
load_modal_env
eval "$(bash "$HERE/setup.sh" | sed -n 's/^\(VENV\|SMS\)=\(.*\)$/\1="\2"/p')"
BUNDLE="${BUNDLE:-$J/deliver_modal/render_bundle_v1.zip}"
[ -f "$BUNDLE" ] || { echo "Render bundle missing" >&2; exit 2; }
INFO="$(python3 "$HERE/make_bundle.py" --validate-only "$BUNDLE")"
read -r SEG EST NSEG MIN <<<"$(INFO="$INFO" MODE="$MODE" SEGOVR="${MOTION_SEGMENT_FRAMES:-}" python3 - <<'PY'
import json,math,os
i=json.loads(os.environ["INFO"])
n=i["frameCount"];minutes=i["durationMs"]/60000
seg=int(os.environ["SEGOVR"] or 0) or min(450,max(150,math.ceil(math.ceil(n/96)/30)*30))
est=min(4.95,max(0.25,(0.10+0.285*minutes)*(3.7 if os.environ["MODE"]=="gpu" else 1)))
print(seg,int(round(est*1_000_000)),math.ceil(n/seg),round(minutes,2))
PY
)"
export MOTION_MODE="$MODE" MOTION_SEGMENT_FRAMES="$SEG" MOTION_ESTIMATE_USD_MICROS="$EST"
export MOTION_BUNDLE_PATH="$BUNDLE" MOTION_BUNDLE_FILENAME="$(basename "$BUNDLE")"
export MOTION_CPU_USD_PER_SECOND=0.00007016 MOTION_GPU_USD_PER_SECOND=0.00023416
export PATH="$VENV/bin:$PATH"
if [ "${DRY_RUN:-0}" = 1 ]; then
  printf '{"dryRun":true,"mode":"%s","segments":%s,"segmentFrames":%s}\n' "$MODE" "$NSEG" "$SEG"
  exit 0
fi
OUT="$J/deliver_modal/modal_submit.stdout"
ERR="$J/deliver_modal/modal_submit.stderr"
set +e; node "$SMS/new-app/scripts/motion-studio/modal_submit.mjs" >"$OUT" 2>"$ERR"; CODE=$?; set -e
if [ "$CODE" -ne 0 ]; then
  echo "Modal submission failed" >&2
  printf '{"exit":%s}\n' "$CODE" > "$J/deliver_modal/submit_failed.json"
  rm -f "$OUT" "$ERR"
  exit "$CODE"
fi
python3 - "$OUT" "$J/deliver_modal/modal_receipt.json" <<'PY'
import json,sys
result=json.load(open(sys.argv[1]))
with open(sys.argv[2],"w") as fh:json.dump({"callId":result.get("callId")},fh)
PY
rm -f "$OUT" "$ERR"
echo "SUBMITTED via Modal"
