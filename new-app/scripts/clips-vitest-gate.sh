#!/usr/bin/env bash
# Vitest files that must pass before clips/editor merges (GitHub Actions off).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec pnpm exec vitest run \
  tests/ai-quality-q5.test.ts \
  tests/ai-quality-q5-selects-route.test.ts \
  tests/ai-quality-q5-full-video-link.test.ts \
  tests/ai-quality-q6.test.ts \
  tests/ai-quality-q6-fix2.test.ts \
  tests/ai-quality-q6-fix3.test.ts \
  tests/clip-project-list-perf.test.ts \
  tests/clip-detail-perf.test.ts \
  tests/db-url.test.ts \
  tests/project-clips-enrich.test.ts \
  tests/editor-shell-render.test.tsx \
  tests/editor-shell-ssr.test.tsx \
  tests/editor-shell-use-editor-words.test.ts \
  tests/layout-panel-mount.test.tsx \
  tests/clip-editor-features-mount.test.tsx \
  tests/studio-sound-undo.test.ts \
  tests/beat-autocut.test.ts \
  tests/g2-beats.test.ts \
  tests/derive-clip.test.ts \
  tests/make-clip-snap-eb785762.test.ts \
  tests/full-video-link.test.ts \
  tests/find-clips-highlights.test.ts \
  tests/use-full-video-highlights.test.tsx \
  tests/multicam-angle-grid.test.tsx \
  tests/multicam-layouts.test.ts \
  tests/multicam-segment-layout-controls.test.tsx \
  tests/multicam-layout-partners.test.ts \
  tests/preview-segment-layout.test.tsx \
  tests/ef24-bg-removal-edits.test.ts \
  tests/ef24-no-rvm-in-web.test.ts \
  tests/clips/layout-packs.test.ts \
  tests/clips/templates-catalog.test.ts \
  tests/highlights-fetch-unwrap.test.ts \
  tests/ui/sidebar-nav-model.test.ts \
  tests/ui/app-sidebar-nav.test.tsx \
  tests/ui/editor-shell-grid.test.tsx \
  tests/ui/editor-wide-properties-empty.test.tsx \
  tests/ui/brand-template-open.test.tsx \
  tests/ui/brand-editor-open.test.tsx \
  tests/ui/visual-guards.test.ts \
  tests/ai-producer-agent/flags-and-validate.test.ts \
  tests/ai-producer-agent/editability.test.ts \
  tests/ai-producer-agent/system-prompt.test.ts \
  tests/ai-producer-agent/mount-flag-off.test.tsx \
  tests/ai-producer-agent/orchestrator.mock-luna.test.ts \
  tests/ai-producer-agent/validate.items.test.ts \
  tests/ai-producer-agent/editability.items.test.ts
