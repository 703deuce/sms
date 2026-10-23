#!/usr/bin/env bash
# Compare ESLint error lines on files changed vs origin/master (same file set on both refs).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF_A="${1:-origin/master}"
REF_B="${2:-HEAD}"
APP="$REPO_ROOT/new-app"
OUT_DIR="${TMPDIR:-/tmp}/eslint-compare-$$"
mkdir -p "$OUT_DIR"

mapfile -t FILES < <(
  git -C "$REPO_ROOT" diff --name-only "$REF_A"..."$REF_B" -- 'new-app/**/*.ts' 'new-app/**/*.tsx' 'new-app/**/*.mjs' \
    | rg -v '^new-app/\.next/' || true
)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No changed TS/TSX files under new-app."
  echo "NEW_ESLINT_ISSUES=0"
  exit 0
fi

run_eslint() {
  local ref="$1"
  local out="$2"
  local tmp
  tmp="$(mktemp -d)"
  git -C "$REPO_ROOT" archive "$ref" new-app | tar -x -C "$tmp" 2>/dev/null || true
  for f in "${FILES[@]}"; do
    rel="${f#new-app/}"
    if git -C "$REPO_ROOT" show "$ref:$f" >/dev/null 2>&1; then
      mkdir -p "$(dirname "$tmp/new-app/$rel")"
      git -C "$REPO_ROOT" show "$ref:$f" > "$tmp/new-app/$rel"
    fi
  done
  ln -sf "$APP/node_modules" "$tmp/new-app/node_modules"
  cd "$tmp/new-app"
  set +e
  ./node_modules/.bin/eslint --no-error-on-unmatched-pattern "${FILES[@]#new-app/}" 2>&1 \
    | rg "error|warning" | sort -u > "$out" || true
  set -e
  rm -rf "$tmp"
}

run_eslint "$REF_A" "$OUT_DIR/master.txt"
cd "$APP"
set +e
./node_modules/.bin/eslint --no-error-on-unmatched-pattern "${FILES[@]#new-app/}" 2>&1 \
  | rg "error|warning" | sort -u > "$OUT_DIR/branch.txt" || true
set -e

comm -13 "$OUT_DIR/master.txt" "$OUT_DIR/branch.txt" > "$OUT_DIR/new-on-branch.txt" || true
NEW_COUNT=$(wc -l < "$OUT_DIR/new-on-branch.txt" | tr -d ' ')
echo "Changed files: ${#FILES[@]}"
echo "NEW_ESLINT_ISSUES=$NEW_COUNT"
if [[ "$NEW_COUNT" -gt 0 ]]; then
  echo "--- New on branch (vs $REF_A) ---"
  cat "$OUT_DIR/new-on-branch.txt"
  exit 1
fi
echo "PASS: no new eslint issues on changed files."
