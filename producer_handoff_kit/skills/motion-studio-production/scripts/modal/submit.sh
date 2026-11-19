#!/usr/bin/env bash
# submit.sh <jobDir> [cpu|gpu]: hand the render to Modal ONCE and exit. Never watch the render.
# Needs <J>/deliver_modal/render_bundle_v1.zip (make_bundle.py). Secrets are read into the environment only, never printed.
# Writes <J>/deliver_modal/submit.json (callId, mode, segments, estimate). Production mode: Modal uploads master+share,
# approves the master, publishes the editable version and calls /complete itself. MOTION_BENCHMARK_ONLY=1 for tests.
set +x; set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; . "$HERE/lib_env.sh"
J="$(cd "${1:?usage: submit.sh <jobDir> [cpu|gpu]}" && pwd)"; MODE="${2:-cpu}"
case "$MODE" in cpu|gpu) ;; *) echo "mode must be cpu or gpu" >&2; exit 2;; esac
D="$J/deliver_modal"; mkdir -p "$D"; chmod 700 "$D"
BUNDLE="${BUNDLE:-$D/render_bundle_v1.zip}"; [ -f "$BUNDLE" ] || { echo "missing $BUNDLE (run make_bundle.py --job-dir $J)" >&2; exit 2; }
if [ -f "$D/submit.json" ] && grep -q '"callId"' "$D/submit.json" && [ "${FORCE_RESUBMIT:-0}" != 1 ]; then
  echo "already submitted (see $D/submit.json). Use status.sh. A resubmission needs FORCE_RESUBMIT=1 and a new bundle filename (BUNDLE=.../render_bundle_v2.zip)." >&2; exit 3; fi
# Production gate: Modal's publish step must carry the live-timeline id remap (patches/publish_editable_remap_live_project.patch),
# otherwise it fails AFTER approving the master and fails the customer job. Whoever deploys the fixed app creates the marker.
if [ "${MOTION_BENCHMARK_ONLY:-0}" = 0 ] && [ ! -f "$HERE/.publish_remap_deployed" ] && [ "${ALLOW_UNPATCHED_PUBLISH:-0}" != 1 ]; then
  echo "BLOCKED (exit 4): the deployed Modal app is not confirmed to remap live-project asset ids at publish (see README.md 'Known blocker'). Use the box fallback path, and tell Rick. Marker: $HERE/.publish_remap_deployed" >&2; exit 4; fi
eval "$(bash "$HERE/setup.sh" | sed -n 's/^\(VENV\|SMS\)=\(.*\)$/\1="\2"/p')"
load_job_env "$J"; load_modal_env
# re-validate the exact file being sent (local, no network)
INFO="$(python3 "$HERE/make_bundle.py" --validate-only "$BUNDLE")"
read -r SEG EST NSEG MIN <<<"$(INFO="$INFO" MODE="$MODE" SEGOVR="${MOTION_SEGMENT_FRAMES:-}" python3 - <<'PY'
import json, math, os
i = json.loads(os.environ["INFO"]); n = i["frameCount"]; minutes = i["durationMs"] / 60000
# Fan-out: <=~96 containers (stays under typical concurrency limits), 150..450 frames (5..15 s) per segment, multiple of 30.
seg = int(os.environ["SEGOVR"] or 0) or min(450, max(150, math.ceil(math.ceil(n / 96) / 30) * 30))
# measured CPU cost $0.19 per rendered minute (1080p); x1.5 margin + $0.10 fixed; GPU measured 3.7x. Capped under the ~$5 job cap.
est = (0.10 + 0.285 * minutes) * (3.7 if os.environ["MODE"] == "gpu" else 1)
est = min(4.95, max(0.25, est))
print(seg, int(round(est * 1_000_000)), math.ceil(n / seg), round(minutes, 2))
PY
)"
export MOTION_MODE="$MODE" MOTION_SEGMENT_FRAMES="$SEG" MOTION_ESTIMATE_USD_MICROS="$EST"
export MOTION_BUNDLE_PATH="$BUNDLE" MOTION_BUNDLE_FILENAME="$(basename "$BUNDLE")"
export MOTION_CPU_USD_PER_SECOND=0.00007016 MOTION_GPU_USD_PER_SECOND=0.00023416
export MOTION_BENCHMARK_ONLY="${MOTION_BENCHMARK_ONLY:-0}" PATH="$VENV/bin:$PATH"
if [ "${DRY_RUN:-0}" = 1 ]; then echo "DRY RUN (nothing sent): mode=$MODE segments=$NSEG x $SEG frames, film ${MIN} min, estimateUsdMicros=$EST, bundle=$MOTION_BUNDLE_FILENAME benchmarkOnly=$MOTION_BENCHMARK_ONLY"; exit 0; fi
OUT="$D/submit.stdout"; ERR="$D/submit.stderr"
set +e; node "$SMS/new-app/scripts/motion-studio/modal_submit.mjs" >"$OUT" 2>"$ERR"; CODE=$?; set -e
red() { sed -E 's#https?://[^ "'"'"']+#[url]#g; s#Bearer +[^ ]+#Bearer [redacted]#g; s#eyJ[A-Za-z0-9_-]{10,}#[redacted]#g'; }
if [ $CODE -ne 0 ]; then echo "SUBMIT FAILED (exit $CODE). Details:"; red < "$ERR" | tail -5; red < "$OUT" | tail -3
  printf '{"failedAt":"%s","exit":%s}\n' "$(TZ=America/New_York date +%FT%T%z)" "$CODE" > "$D/submit_failed.json"; exit $CODE; fi
CALL="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read().strip().splitlines()[-1])["callId"])' < "$OUT")"
python3 - "$D/submit.json" <<PY
import json, sys, os
json.dump({"jobId": os.environ["MOTION_JOB_ID"], "callId": "$CALL", "mode": "$MODE", "segmentFrames": $SEG, "segments": $NSEG,
  "filmMinutes": $MIN, "estimateUsdMicros": $EST, "bundle": os.environ["MOTION_BUNDLE_FILENAME"],
  "benchmarkOnly": os.environ["MOTION_BENCHMARK_ONLY"] != "0",
  "submittedAt": "$(TZ=America/New_York date +%FT%T%z)"}, open(sys.argv[1], "w"), indent=1)
PY
chmod 600 "$D/submit.json"; rm -f "$D/submit_failed.json" "$OUT" "$ERR"
echo "SUBMITTED mode=$MODE segments=$NSEG x $SEG frames, film ${MIN} min, estimate \$$(python3 -c "print(round($EST/1e6,2))"). callId in $D/submit.json. Stop here: Modal renders, runs QA, uploads and completes. Check once with: bash $HERE/status.sh $J"
