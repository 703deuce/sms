#!/usr/bin/env bash
# Typecheck from a clean git tree to avoid local .next / duplicate prisma skew.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$REPO_ROOT/new-app"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

(cd "$REPO_ROOT" && npx prisma generate --schema=prisma/schema.prisma >/dev/null)

git -C "$REPO_ROOT" archive HEAD new-app | tar -x -C "$TMP"
ln -sf "$APP/node_modules" "$TMP/new-app/node_modules"
for f in tsconfig.json tsconfig.typecheck.json next-env.d.ts; do
  if [[ -f "$APP/$f" ]]; then
    cp "$APP/$f" "$TMP/new-app/$f"
  fi
done

cd "$TMP/new-app"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
./node_modules/.bin/tsc -p tsconfig.typecheck.json --noEmit "$@"
status=$?
exit "$status"
