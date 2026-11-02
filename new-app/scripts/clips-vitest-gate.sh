#!/usr/bin/env bash
# Vitest files that must pass before clips/editor merges (GitHub Actions off).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec pnpm exec vitest run \
  tests/ai-quality-q5.test.ts \
  tests/ai-quality-q5-selects-route.test.ts \
  tests/ai-quality-q5-full-video-link.test.ts \
<<<<<<< HEAD
=======
  tests/ai-quality-q6.test.ts \
>>>>>>> origin/master
  tests/editor-shell-render.test.tsx \
  tests/editor-shell-ssr.test.tsx \
  tests/editor-shell-use-editor-words.test.ts \
  tests/layout-panel-mount.test.tsx \
  tests/clip-editor-features-mount.test.tsx \
  tests/studio-sound-undo.test.ts \
  tests/beat-autocut.test.ts \
  tests/g2-beats.test.ts \
  tests/derive-clip.test.ts \
  tests/full-video-link.test.ts
