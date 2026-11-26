#!/usr/bin/env bash
# status.sh <jobDir>: print the redacted /render-status once (queued, rendering n/N, qa_pass|qa_fail, uploaded, completed). No polling.
set +x; set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; . "$HERE/lib_env.sh"
J="$(cd "${1:?usage: status.sh <jobDir>}" && pwd)"
[ -f "$J/deliver_modal/submit.json" ] && python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print("submitted:", {k:d[k] for k in ("mode","segments","segmentFrames","filmMinutes","submittedAt","benchmarkOnly")})' "$J/deliver_modal/submit.json"
load_job_env "$J"; python3 "$HERE/render_status.py"
