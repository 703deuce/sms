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

copy_if_repo() {
  local src="$1"
  local out="$2"
  if [ -s "$out" ]; then
    return 0
  fi
  if [ -s "$src" ]; then
    cp -f "$src" "$out"
  fi
}

# Repo-pinned faces (same bytes as new-app/public/fonts/clip)
copy_if_repo "$V3/fonts/Montserrat-Black.ttf" "$DEST/Montserrat-Black.ttf"
copy_if_repo "$V3/fonts/Poppins-ExtraBold.ttf" "$DEST/Poppins-ExtraBold.ttf"
copy_if_repo "$V3/fonts/Anton-Regular.ttf" "$DEST/Anton-Regular.ttf"
for ttf in "$V3/t6"/*.ttf; do
  [ -f "$ttf" ] || continue
  cp -f "$ttf" "$DEST/$(basename "$ttf")"
done

download \
  "https://raw.githubusercontent.com/googlefonts/roboto-2/main/src/hinted/Roboto-Bold.ttf" \
  "$DEST/Roboto-Bold.ttf"
# Playfair Display is already pinned in $V3/t6/PlayfairDisplay.ttf.
# Do not fetch the variable upstream version: it creates a competing family.
download \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf" \
  "$DEST/Oswald-wght.ttf"

cp -f "$DEST/Roboto-Bold.ttf" "$V3/t6/Roboto-Bold.ttf"
if [ -s "$DEST/Oswald-wght.ttf" ]; then
  cp -f "$DEST/Oswald-wght.ttf" "$V3/t6/Oswald.ttf"
fi

for f in "$DEST"/*.ttf; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  case "$base" in
    Montserrat-Black.ttf|Poppins-ExtraBold.ttf|Anton-Regular.ttf) cp -f "$f" "$V3/fonts/$base" ;;
    *) cp -f "$f" "$V3/t6/$base" 2>/dev/null || true ;;
  esac
done

if command -v fc-cache >/dev/null 2>&1; then
  fc-cache -f "$DEST" || fc-cache -f
fi

echo "[brand-fonts] installed in $DEST"
