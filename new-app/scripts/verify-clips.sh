#!/usr/bin/env bash
# Full local clips merge gate (Rick does not use GitHub Actions).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

run() {
  echo "== verify:clips: $* =="
  "$@"
}

echo "== verify:clips: tsc --noEmit =="
NODE_OPTIONS='--max-old-space-size=8192' npx tsc -p tsconfig.typecheck.json --noEmit

run pnpm run verify:editor-shell-import
run pnpm run verify:editor-hook-imports
run pnpm run verify:editor-jsx-imports
run pnpm run verify:clip-editor-feature-parity
run pnpm run verify:editor-shell-hook-order
run pnpm run verify:clips-editor-eslint
run pnpm run verify:migration-table-refs
run pnpm run verify:app-route-dynamic-segments
run pnpm run typecheck:clips

echo "== verify:clips: vitest (full new-app suite) =="
pnpm exec vitest run

echo "== verify:clips: next build =="
pnpm run build

echo "PASS verify:clips — tsc + guards + typecheck:clips + vitest + next build"
