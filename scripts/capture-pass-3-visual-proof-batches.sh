#!/usr/bin/env bash
# Start dev once (with bypass), then run the fast capture script (~1–2 min).
set -euo pipefail
cd "$(dirname "$0")/.."
export DEV_AUTH_BYPASS=1
export DEV_AUTH_BYPASS_EMAIL="${DEV_AUTH_BYPASS_EMAIL:-alex@harborhome.co}"
export UI_AGENT_BASE_URL="${UI_AGENT_BASE_URL:-http://localhost:3000}"
SESSION_NAME="pass3b-dev-auth"
PHASE="${1:-after}"

if ! curl -sf "$UI_AGENT_BASE_URL/api/health" >/dev/null; then
  tmux -f /exec-daemon/tmux.portal.conf kill-session -t "$SESSION_NAME" 2>/dev/null || true
  tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "/workspace" -- \
    "${SHELL:-bash}" -l -c 'export DEV_AUTH_BYPASS=1 DEV_AUTH_BYPASS_EMAIL='"${DEV_AUTH_BYPASS_EMAIL}"'; exec npm run dev'
  for _ in $(seq 1 30); do
    curl -sf "$UI_AGENT_BASE_URL/api/health" >/dev/null && break
    sleep 2
  done
fi

time npx tsx scripts/capture-pass-3-visual-proof.ts --phase "$PHASE"
