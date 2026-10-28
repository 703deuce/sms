#!/usr/bin/env bash
set -euo pipefail
DEST="${1:-/app/assets/twemoji}"
BASE="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72"
mkdir -p "$DEST"
export PYTHONPATH="${PYTHONPATH:-/app}"
python3 - <<'PY'
from clips_worker.caption_emoji_overlay import twemoji_codepoint
from clips_worker.emoji_whitelist import EMOJI_WHITELIST
for emo in EMOJI_WHITELIST:
    cp = twemoji_codepoint(emo)
    if cp:
        print(cp)
PY
| while read -r cp; do
  out="$DEST/${cp}.png"
  if [[ -f "$out" ]]; then
    continue
  fi
  curl -fsSL -o "$out" "${BASE}/${cp}.png"
done
echo "twemoji pngs in $DEST ($(find "$DEST" -name '*.png' | wc -l) files)"
