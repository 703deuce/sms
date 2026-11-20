#!/usr/bin/env bash
set +x; set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib_env.sh"
J="$(cd "${1:?usage: submit.sh JOB_DIR [cpu|gpu]}" && pwd)"
load_job_env "$J"
export MOTION_MODE="${2:-cpu}"
exec python3 "$HERE/submit.py" "$J"
