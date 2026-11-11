#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT
npx tsc -p tsconfig.real-video-templates-b8.json --noEmit --pretty false >"$OUT" 2>&1 || true
OWNED_RE='^(lib/clips/real-video-templates/b8-|scripts/(template-factory|export-b8-worker-contract)|tests/clips/b8-template-factory)'
if rg -q "$OWNED_RE.* error TS" "$OUT"; then
  rg "$OWNED_RE.* error TS" "$OUT" || true
  echo "[typecheck:templates:b8] FAILED — Batch 8-owned TypeScript errors" >&2
  exit 1
fi
echo "[typecheck:templates:b8] ok — no errors in Batch 8-owned paths (repo transitive baseline ignored)"
