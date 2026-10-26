#!/usr/bin/env bash
# Compare tsc error lines between two git refs using the same typecheck config as npm run typecheck.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF_A="${1:-origin/master}"
REF_B="${2:-HEAD}"
APP="$REPO_ROOT/new-app"
OUT_DIR="${TMPDIR:-/tmp}/tsc-compare-$$"
mkdir -p "$OUT_DIR"

run_tsc_for_ref() {
  local ref="$1"
  local out="$2"
  local tmp
  tmp="$(mktemp -d)"
  (cd "$REPO_ROOT" && npx prisma generate --schema=new-app/prisma/schema.prisma >/dev/null)
  git -C "$REPO_ROOT" archive "$ref" new-app | tar -x -C "$tmp"
  ln -sf "$APP/node_modules" "$tmp/new-app/node_modules"
  for f in tsconfig.json tsconfig.typecheck.json; do
    if git -C "$REPO_ROOT" show "$ref:new-app/$f" >/dev/null 2>&1; then
      git -C "$REPO_ROOT" show "$ref:new-app/$f" > "$tmp/new-app/$f"
    elif [[ -f "$APP/$f" ]]; then
      cp "$APP/$f" "$tmp/new-app/$f"
    fi
  done
  cd "$tmp/new-app"
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
  set +e
  ./node_modules/.bin/tsc -p tsconfig.typecheck.json --noEmit 2>&1 | rg "error TS" | sort -u > "$out"
  local code=$?
  set -e
  wc -l < "$out" | tr -d ' ' > "${out}.count"
  echo "$code" > "${out}.exit"
  rm -rf "$tmp"
}

run_tsc_for_ref "$REF_A" "$OUT_DIR/master.txt"
run_tsc_for_ref "$REF_B" "$OUT_DIR/branch.txt"

comm -13 "$OUT_DIR/master.txt" "$OUT_DIR/branch.txt" > "$OUT_DIR/new-on-branch.txt" || true
comm -23 "$OUT_DIR/master.txt" "$OUT_DIR/branch.txt" > "$OUT_DIR/gone-on-branch.txt" || true

echo "REF_A=$REF_A count=$(cat "$OUT_DIR/master.txt.count") exit=$(cat "$OUT_DIR/master.txt.exit")"
echo "REF_B=$REF_B count=$(cat "$OUT_DIR/branch.txt.count") exit=$(cat "$OUT_DIR/branch.txt.exit")"
echo "NEW_ON_BRANCH=$(wc -l < "$OUT_DIR/new-on-branch.txt" | tr -d ' ')"
echo "OUT_DIR=$OUT_DIR"
