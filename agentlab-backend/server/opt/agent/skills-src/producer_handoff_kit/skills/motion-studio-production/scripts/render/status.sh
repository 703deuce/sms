#!/usr/bin/env bash
set +x; set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib_env.sh"
J="$(cd "${1:?usage: status.sh JOB_DIR}" && pwd)"
load_job_env "$J"
[ -f "$J/deliver_modal/submit.json" ] && python3 - "$J/deliver_modal/submit.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
print("submitted:",{k:d.get(k) for k in ("backend","mode","segments","segmentFrames","filmMinutes","submittedAt","benchmarkOnly")})
PY
python3 "$HERE/render_status.py"
