#!/usr/bin/env bash
# Pre-push gate for web + clipper touch surfaces. Run from repo root or new-app/.
# For Agent A: use before every web push — `bash new-app/scripts/prepush-check.sh`
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/.." && pwd)"
cd "$APP_ROOT"

echo "== prepush: next build =="
pnpm next build

echo "== prepush: vitest (streamer + clipper export/polish) =="
pnpm exec vitest run \
  tests/streamer-pipeline-status.test.ts \
  tests/streamer-flags.test.ts \
  tests/export-polish-lint.test.ts \
  tests/export-template.test.ts \
  tests/export-platform-presets.test.ts \
  tests/export-preview-reuse.test.ts \
  tests/loop-friendly-trim.test.ts \
  tests/post-copy-hashtags.test.ts \
  tests/polish-render-caption-sync.test.ts \
  tests/can-retry-clip-project.test.ts \
  tests/upload-finalize.test.ts

if [[ -d "$REPO_ROOT/worker/tests" ]]; then
  echo "== prepush: worker pytest (clipper render/export) =="
  cd "$REPO_ROOT/worker"
  python3 -m pytest \
    tests/test_polish_render_sync.py \
    tests/test_zoom_filtergraph_valid.py \
    tests/test_export_sfx.py \
    tests/test_loop_friendly_trim.py \
    tests/test_silence_trim.py \
    tests/test_replace_clip_pick.py \
    tests/test_edits_render_zoom.py \
    -q
fi

echo "== prepush: OK =="
