#!/usr/bin/env bash
# reuse.sh <jobDir> <sourceJobId> [extra reuse_assets.py flags]: on a RETRY job for the same project, borrow the earlier
# job's ready render_bundle_v1.zip + modal_seg_*.mp4 via POST /assets receipts + reuse, BEFORE submit.sh.
# Then: MOTION_SEGMENT_FRAMES=<same as the source submit> bash submit.sh <jobDir> cpu  (Modal skips ready segments).
# Only when Rick approved the retry. Never prints secrets.
set +x; set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; . "$HERE/lib_env.sh"
J="$(cd "${1:?usage: reuse.sh <jobDir> <sourceJobId>}" && pwd)"; SRC="${2:?sourceJobId}"; shift 2
load_job_env "$J"; python3 "$HERE/reuse_assets.py" "$J" "$SRC" "$@"
