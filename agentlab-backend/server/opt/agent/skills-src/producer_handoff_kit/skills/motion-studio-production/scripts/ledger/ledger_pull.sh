#!/usr/bin/env bash
# Pull the shared Motion Studio style ledger from GitHub (703deuce/sms master).
# The GitHub copy is the ONE ledger shared by every production bot (Rick, Nov 21).
# Writes it to /workspace/motion_jobs/STYLE_LEDGER.md (or $1) and prints the last 5 entry headings.
# Needs: gh CLI with GH_TOKEN (push access to 703deuce/sms). Never prints the token.
set -euo pipefail
REPO="${LEDGER_REPO:-703deuce/sms}"; BRANCH="${LEDGER_BRANCH:-master}"
PATH_IN_REPO="${LEDGER_PATH:-producer_handoff_kit/ledgers/STYLE_LEDGER.md}"
OUT="${1:-/workspace/motion_jobs/STYLE_LEDGER.md}"
mkdir -p "$(dirname "$OUT")"
gh api -H "Accept: application/vnd.github.raw" "repos/$REPO/contents/$PATH_IN_REPO?ref=$BRANCH" > "$OUT.tmp"
[ -s "$OUT.tmp" ] || { echo "ledger_pull: empty download, keeping old copy" >&2; rm -f "$OUT.tmp"; exit 1; }
mv "$OUT.tmp" "$OUT"
echo "ledger_pull: $OUT updated from $REPO@$BRANCH"
echo "Last 5 films (all bots):"; grep -n '^## 20' "$OUT" | tail -5
