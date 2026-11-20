#!/usr/bin/env bash
# Parameterized wrapper around new-app/scripts/motion-studio/modal_submit.mjs.
# Required env:
#   MODAL_TOKEN_ID, MODAL_TOKEN_SECRET, MODAL_APP_NAME (default transovo-motion-render)
#   MOTION_JOB_ID, MOTION_JOB_URL, MOTION_JOB_TOKEN
#   MOTION_BUNDLE_PATH (local path to render_bundle_v1.zip) OR MOTION_BUNDLE_FILENAME
# Optional env:
#   MOTION_MODE (cpu|gpu, default cpu), MOTION_SEGMENT_FRAMES (default 150)
#   REPO_ROOT (default git rev-parse --show-toplevel)
set +x
set -euo pipefail

MODE="${1:-${MOTION_MODE:-cpu}}"
if [ "$MODE" != "cpu" ] && [ "$MODE" != "gpu" ]; then
  echo "mode must be cpu or gpu" >&2
  exit 2
fi

REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
export MOTION_MODE="$MODE"
export MODAL_APP_NAME="${MODAL_APP_NAME:-transovo-motion-render}"
export MOTION_CPU_USD_PER_SECOND="${MOTION_CPU_USD_PER_SECOND:-0.00007016}"
export MOTION_GPU_USD_PER_SECOND="${MOTION_GPU_USD_PER_SECOND:-0.00023416}"
export MOTION_SEGMENT_FRAMES="${MOTION_SEGMENT_FRAMES:-150}"

node "${REPO_ROOT}/new-app/scripts/motion-studio/modal_submit.mjs"
