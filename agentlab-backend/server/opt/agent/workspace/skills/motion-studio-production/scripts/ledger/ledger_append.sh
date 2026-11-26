#!/usr/bin/env bash
# Append one style-ledger entry to the shared ledger on GitHub (703deuce/sms master), right after delivery.
# Usage: ledger_append.sh <entry.md> [botName]
#   entry.md = the full entry ("## <date> · <jobId> · <title>" + bullet lines, including the "- Variety:" line).
# Reads the latest ledger from GitHub, appends at the bottom, commits with the file's sha, and retries on
# conflicts, so entries from all production bots land in one running ledger. Then refreshes the local copy.
# Needs: gh CLI with GH_TOKEN (push access). Never prints the token.
set -euo pipefail
ENTRY="${1:?usage: ledger_append.sh <entry.md> [botName]}"; BOT="${2:-producer}"
REPO="${LEDGER_REPO:-703deuce/sms}"; BRANCH="${LEDGER_BRANCH:-master}"
PATH_IN_REPO="${LEDGER_PATH:-producer_handoff_kit/ledgers/STYLE_LEDGER.md}"
LOCAL="${LEDGER_LOCAL:-/workspace/motion_jobs/STYLE_LEDGER.md}"
grep -q '^## ' "$ENTRY" || { echo "ledger_append: entry must start with a '## <date> · <jobId> · <title>' heading" >&2; exit 2; }
HEAD_LINE="$(grep -m1 '^## ' "$ENTRY")"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
for attempt in 1 2 3 4 5; do
  gh api "repos/$REPO/contents/$PATH_IN_REPO?ref=$BRANCH" > "$TMP/meta.json"
  SHA="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["sha"])' "$TMP/meta.json")"
  python3 -c 'import json,sys,base64;sys.stdout.buffer.write(base64.b64decode(json.load(open(sys.argv[1]))["content"]))' "$TMP/meta.json" > "$TMP/ledger.md"
  if grep -qxF "$HEAD_LINE" "$TMP/ledger.md"; then echo "ledger_append: entry already on GitHub, nothing to do"; break; fi
  { cat "$TMP/ledger.md"; [ -z "$(tail -c1 "$TMP/ledger.md")" ] || echo; echo; cat "$ENTRY"; } > "$TMP/new.md"
  python3 - "$TMP/new.md" "$SHA" "$BRANCH" "ledger: $BOT · ${HEAD_LINE#\#\# }" > "$TMP/body.json" <<'PY'
import json,sys,base64
p,sha,br,msg=sys.argv[1:5]
print(json.dumps({"message":msg[:200],"content":base64.b64encode(open(p,'rb').read()).decode(),"sha":sha,"branch":br}))
PY
  if gh api -X PUT "repos/$REPO/contents/$PATH_IN_REPO" --input "$TMP/body.json" > "$TMP/put.json" 2>"$TMP/err"; then
    echo "ledger_append: pushed ($(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["commit"]["sha"][:7])' "$TMP/put.json"))"; break
  fi
  echo "ledger_append: attempt $attempt conflicted or failed, retrying" >&2; sleep $((attempt*2))
  [ "$attempt" = 5 ] && { cat "$TMP/err" >&2; echo "ledger_append: FAILED, entry not on GitHub; tell Rick" >&2; exit 1; }
done
bash "$(dirname "$0")/ledger_pull.sh" "$LOCAL" >/dev/null && echo "ledger_append: local copy refreshed"
