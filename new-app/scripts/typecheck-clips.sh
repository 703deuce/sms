#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="$(mktemp)"
if ! npx tsc -p tsconfig.typecheck.json --noEmit --pretty false >"$OUT" 2>&1; then
  if rg -q '^(components/clips|lib/clips|app/app/clips|app/api/clips|lib/server/clips)/' "$OUT"; then
    cat "$OUT"
    rm -f "$OUT"
    echo "[typecheck:clips] FAILED — errors under clips paths" >&2
    exit 1
  fi
fi
rm -f "$OUT"
echo "[typecheck:clips] ok"
