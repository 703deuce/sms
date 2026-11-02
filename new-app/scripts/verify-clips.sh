#!/usr/bin/env bash
# Full local clips merge gate (Rick does not use GitHub Actions).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

run() {
  echo "== verify:clips: $* =="
  "$@"
}

run pnpm run verify:editor-shell-import
run pnpm run verify:editor-hook-imports
run pnpm run verify:editor-jsx-imports
run pnpm run verify:clip-editor-feature-parity
run pnpm run verify:editor-shell-hook-order
run pnpm run verify:clips-editor-eslint
run pnpm run verify:migration-table-refs
run pnpm run verify:app-route-dynamic-segments
run pnpm run typecheck:clips

echo "== verify:clips: vitest (clips merge gate; optional full suite: pnpm test) =="
bash scripts/clips-vitest-gate.sh

echo "== verify:clips: next build =="
pnpm run build

echo "PASS verify:clips — guards + typecheck:clips + clips-vitest-gate + next build"
