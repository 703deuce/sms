#!/usr/bin/env bash
# Install curated brand Google fonts (see new-app/lib/clips/brand-kit.ts) for caption/title export.
set -euo pipefail

DEST="${1:-/usr/share/fonts/truetype/transovo-brand}"
V3="${2:-/app/v3/fonts}"
mkdir -p "$DEST" "$V3/t6" "$V3/fonts"

download() {
  local url="$1"
  local out="$2"
  if [ -s "$out" ]; then
    echo "[brand-fonts] skip existing $(basename "$out")"
    return 0
  fi
  echo "[brand-fonts] fetch $(basename "$out")"
  curl -fsSL "$url" -o "$out"
  test -s "$out"
}

# google/fonts raw paths (static TTF)
BASE="https://github.com/google/fonts/raw/main"
download "$BASE/ofl/roboto/static/Roboto-Bold.ttf" "$DEST/Roboto-Bold.ttf"
download "$BASE/ofl/playfairdisplay/static/PlayfairDisplay-Bold.ttf" "$DEST/PlayfairDisplay-Bold.ttf"
download "$BASE/ofl/playfairdisplay/static/PlayfairDisplay-Regular.ttf" "$DEST/PlayfairDisplay-Regular.ttf"

# Symlink / copy into worker v3 dirs used by captions_ass (if not already pinned elsewhere)
for f in Roboto-Bold.ttf PlayfairDisplay-Bold.ttf PlayfairDisplay-Regular.ttf; do
  cp -f "$DEST/$f" "$V3/t6/$f" 2>/dev/null || cp -f "$DEST/$f" "$V3/fonts/$f"
done

if command -v fc-cache >/dev/null 2>&1; then
  fc-cache -f "$DEST" || fc-cache -f
fi

echo "[brand-fonts] installed in $DEST"
