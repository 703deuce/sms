#!/usr/bin/env bash
set -euo pipefail
DEST="${1:-/app/assets/twemoji}"
BASE="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72"
mkdir -p "$DEST"
export PYTHONPATH="${PYTHONPATH:-/app}"
CPS="$(python3 - <<'PY'
from clips_worker.caption_emoji_overlay import twemoji_codepoint
from clips_worker.emoji_whitelist import EMOJI_WHITELIST
seen = set()
for emo in EMOJI_WHITELIST:
    cp = twemoji_codepoint(emo)
    if cp and cp not in seen:
        seen.add(cp)
        print(cp)
PY
)"
while read -r cp; do
  [[ -n "$cp" ]] || continue
  out="$DEST/${cp}.png"
  if [[ -f "$out" ]]; then
    continue
  fi
  curl -fsSL -o "$out" "${BASE}/${cp}.png"
done <<< "$CPS"
echo "twemoji pngs in $DEST ($(find "$DEST" -name '*.png' | wc -l) files)"
