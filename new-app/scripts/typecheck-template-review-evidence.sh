#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT
npx tsc -p tsconfig.real-video-template-review.json --noEmit --pretty false >"$OUT" 2>&1 || true
OWNED_RE='^(lib/clips/real-video-templates/review-evidence|scripts/template-review-evidence|tests/clips/template-review-evidence)'
if rg -q "$OWNED_RE.* error TS" "$OUT"; then
  rg "$OWNED_RE.* error TS" "$OUT" || true
  echo "[typecheck:templates:review] FAILED — review evidence TypeScript errors" >&2
  exit 1
fi
echo "[typecheck:templates:review] ok — no errors in review evidence paths"
