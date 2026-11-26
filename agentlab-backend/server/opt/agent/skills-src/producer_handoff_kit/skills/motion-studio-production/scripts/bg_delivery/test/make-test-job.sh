#!/usr/bin/env bash
# make-test-job.sh <dest> <port>: copy a saved LIVE package (no secrets) and point it at the local mock.
set -euo pipefail
SRC=${BG_TEST_SRC:-/workspace/motion_jobs/msaj_6c02fc45-d3fa-4e67-8ac7-dc8b6807ab6d/editable/live}
D="$1"; PORT="$2"; JOB="msaj_$(cat /proc/sys/kernel/random/uuid)"
rm -rf "$D"; mkdir -p "$D/editable/live" "$D/secrets"; chmod 700 "$D/secrets"
cp -a "$SRC/payload" "$SRC/store" "$D/editable/live/"; rm -f "$D/editable/live/payload/live-publish-receipt.json" "$D/editable/live/payload/live.packed.json"
( umask 177; head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$D/secrets/token"
  printf 'http://127.0.0.1:%s/api/motion-studio/agent/jobs/%s' "$PORT" "$JOB" > "$D/secrets/job_url" )
echo "$JOB"
