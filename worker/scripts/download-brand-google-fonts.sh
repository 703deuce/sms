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

download \
  "https://raw.githubusercontent.com/googlefonts/roboto-2/main/src/hinted/Roboto-Bold.ttf" \
  "$DEST/Roboto-Bold.ttf"
download \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf" \
  "$DEST/PlayfairDisplay-wght.ttf"

cp -f "$DEST/Roboto-Bold.ttf" "$V3/t6/Roboto-Bold.ttf"
cp -f "$DEST/PlayfairDisplay-wght.ttf" "$V3/t6/PlayfairDisplay-wght.ttf"

if command -v fc-cache >/dev/null 2>&1; then
  fc-cache -f "$DEST" || fc-cache -f
fi

echo "[brand-fonts] installed in $DEST"
