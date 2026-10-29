#!/usr/bin/env bash
# Download the 5 short C3 eval windows (~3 min each, 480p) before the Twitch VODs expire (~early Dec 2026).
# Usage: ./download_c3_windows.sh [labels_c3.json] [out_dir]
# Needs: yt-dlp >= 2024.x and ffmpeg on PATH (pip install -U yt-dlp). Idempotent: skips files that exist.
set -euo pipefail
LABELS="${1:-$(dirname "$0")/labels_c3.json}"
OUT="${2:-$HOME/c3_windows}"
mkdir -p "$OUT"
python3 - "$LABELS" <<'PY' > "$OUT/.jobs.tsv"
import json, sys
for c in json.load(open(sys.argv[1]))["cases"]:
    s = c["source"]
    sec = "" if s.get("clip_only") else f'*{s["vod_start_s"]}-{s["vod_end_s"]}'
    print(f'{c["id"]}\t{s["url"]}\t{sec}')
PY
fail=0
while IFS=$'\t' read -r id url sec; do
  dest="$OUT/$id.mp4"
  if [[ -s "$dest" ]]; then echo "skip $id (exists)"; continue; fi
  args=(-f "best[height<=480]/best" --no-part --merge-output-format mp4 -o "$dest")
  [[ -n "$sec" ]] && args+=(--download-sections "$sec" --force-keyframes-at-cuts)
  echo "get $id $url ${sec:-whole clip}"
  if ! yt-dlp "${args[@]}" "$url"; then echo "FAILED $id" >&2; fail=1; continue; fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$dest" || echo 0)
  echo "ok $id duration=${dur}s"
done < "$OUT/.jobs.tsv"
rm -f "$OUT/.jobs.tsv"
exit $fail
