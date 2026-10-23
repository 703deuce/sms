#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist"
rm -rf "$OUT"
mkdir -p "$OUT"
cp "$ROOT/manifest.json" "$ROOT/background.js" "$ROOT/content.js" "$ROOT/phone-detect.js" "$ROOT/options.html" "$ROOT/options.js" "$OUT/"
(cd "$OUT" && zip -r transovo-click-to-call.zip .)
echo "Packaged: $OUT/transovo-click-to-call.zip"
