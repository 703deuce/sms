#!/usr/bin/env bash
# Download fountain.io sample scripts for local golden tests (not committed).
set -euo pipefail
DIR="${1:-new-app/lib/screenwriting/__fixtures__}"
mkdir -p "$DIR"
BASE="https://fountain.io/_downloads"
for name in "Brick-&-Steel" "Big-Fish" "The-Last-Birthday-Card"; do
  for ext in fountain fdx pdf; do
    out="$DIR/${name}.${ext}"
    if [ -f "$out" ]; then
      echo "[sw-fixtures] skip existing $out"
      continue
    fi
    echo "[sw-fixtures] fetch $name.$ext"
    curl -fsSL "$BASE/${name}.${ext}" -o "$out" || echo "[sw-fixtures] WARN: failed $name.$ext"
  done
done
echo "[sw-fixtures] done → $DIR"
