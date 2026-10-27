#!/usr/bin/env bash
# Gate master pushes: 8GB heap tsc + next build (Coolify parity). Skip with SKIP_WEB_VERIFY=1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/new-app"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

if [[ "${SKIP_WEB_VERIFY:-}" == "1" ]]; then
  echo "[verify-web] SKIP_WEB_VERIFY=1 — skipped"
  exit 0
fi

echo "[verify-web] prisma generate"
(cd "$APP" && pnpm exec prisma generate --schema=prisma/schema.prisma)

echo "[verify-web] tsc --noEmit (tsconfig.typecheck.json, heap=${NODE_OPTIONS})"
(cd "$APP" && pnpm exec tsc -p tsconfig.typecheck.json --noEmit)

echo "[verify-web] next build (heap=${NODE_OPTIONS})"
(cd "$APP" && pnpm run build)

echo "[verify-web] ok"
