#!/usr/bin/env bash
set +x; set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/lib_env.sh"
J="$(cd "${1:?usage: reuse.sh JOB_DIR SOURCE_JOB_ID}" && pwd)"
SRC="${2:?missing source job id}"
shift 2
load_job_env "$J"
exec python3 "$HERE/reuse_assets.py" "$J" "$SRC" "$@"
