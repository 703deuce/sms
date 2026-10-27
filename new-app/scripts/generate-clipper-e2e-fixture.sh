#!/usr/bin/env bash
# 30s H.264 fixture for clipper-smoke E2E (not committed — run locally).
set -euo pipefail
OUT="$(cd "$(dirname "$0")/.." && pwd)/e2e/fixtures/clipper-smoke-30s.mp4"
mkdir -p "$(dirname "$OUT")"
ffmpeg -y -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 \
  -t 30 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$OUT"
echo "Wrote $OUT"
