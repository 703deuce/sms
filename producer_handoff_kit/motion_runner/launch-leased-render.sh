#!/usr/bin/env bash
# Launch the leased render runner with a clean env: only the 4 Motion Studio vars
# from /workspace/secrets/motion_runner.env plus normal runtime vars.
# The assignment JSON is read from this script's stdin and piped straight through.
# Never sources motion_production.env. Never echoes values.
set -euo pipefail
ENVF=/workspace/secrets/motion_runner.env
get() { sed -n "s/^$1=//p" "$ENVF" | tail -n1; }
WID=$(get MOTION_STUDIO_WORKER_ID); WTOK=$(get MOTION_STUDIO_WORKER_TOKEN)
URL=$(get MOTION_STUDIO_AGENT_PUBLIC_URL); KIT=$(get MOTION_STUDIO_PRODUCER_KIT)
if [ -z "$WID" ] || [ -z "$WTOK" ]; then echo "motion_runner.env: worker ID/token not set yet" >&2; exit 3; fi
case "$URL" in https://transovo.ai|https://transovo.ai/) ;; *) echo "untrusted MOTION_STUDIO_AGENT_PUBLIC_URL" >&2; exit 4;; esac
NODE=$(command -v node)
exec env -i PATH="$PATH" HOME="$HOME" USER="${USER:-box}" LANG="${LANG:-C.UTF-8}" TZ="${TZ:-America/New_York}" TMPDIR="${TMPDIR:-/tmp}" \
  ${PLAYWRIGHT_BROWSERS_PATH:+PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_PATH"} \
  MOTION_STUDIO_WORKER_ID="$WID" MOTION_STUDIO_WORKER_TOKEN="$WTOK" \
  MOTION_STUDIO_AGENT_PUBLIC_URL="$URL" MOTION_STUDIO_PRODUCER_KIT="$KIT" \
  "$NODE" "$KIT/producer/bin/run-leased-render.mjs"
