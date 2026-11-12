#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT
npx tsc -p tsconfig.real-video-templates-b9.json --noEmit --pretty false >"$OUT" 2>&1 || true
OWNED_RE='^(lib/clips/real-video-templates/batch9-|scripts/batch9-|tests/clips/real-video-template-batch9-)'
if grep -Eq "$OWNED_RE.* error TS" "$OUT"; then
  grep -E "$OWNED_RE.* error TS" "$OUT" || true
  echo "[typecheck:templates:b9] FAILED — Batch 9-owned TypeScript errors" >&2
  exit 1
fi
echo "[typecheck:templates:b9] ok — no errors in Batch 9-owned paths"
