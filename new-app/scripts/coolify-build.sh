#!/usr/bin/env bash
# Production build for transovo-new-app (no legacy monolith compile).
# Expects cwd=new-app; Prisma schema from ../prisma when Coolify build context is repo root.
set -euo pipefail

export PRISMA_GENERATE_SKIP_AUTOINSTALL="${PRISMA_GENERATE_SKIP_AUTOINSTALL:-true}"

heartbeat_interval="${COOLIFY_BUILD_HEARTBEAT_SECS:-20}"

PNPM="${PNPM:-npx --yes pnpm@12.3.4}"

echo "[new-app/coolify-build] starting next production build ($PNPM)"
echo "[new-app/coolify-build] node=$(node -v) cwd=$(pwd)"

if [[ -f ../prisma/schema.prisma ]]; then
  echo "[new-app/coolify-build] syncing Prisma schema from monorepo parent"
  rm -rf prisma
  cp -a ../prisma prisma
  # Keep generated client in new-app/node_modules (default); never point output outside new-app.
  if grep -qE '^[[:space:]]*output[[:space:]]*=' prisma/schema.prisma; then
    sed -i '/^[[:space:]]*output[[:space:]]*=/d' prisma/schema.prisma
  fi
elif [[ ! -f prisma/schema.prisma ]]; then
  echo "[new-app/coolify-build] ERROR: missing prisma/schema.prisma (expected ../prisma in Coolify monorepo checkout)"
  exit 1
fi

echo "[new-app/coolify-build] caption parity (vitest)"
$PNPM exec vitest run tests/caption-parity --config vitest.config.mts

if [[ "${SKIP_VOICE_V3_SYNC:-}" != "1" && -f ../packages/transovo-voice-v3-runtime/sync-to-new-app.mjs ]]; then
  echo "[new-app/coolify-build] sync Voice V3 authority (src/lib/voice-v3 → new-app mirror)"
  node ../packages/transovo-voice-v3-runtime/sync-to-new-app.mjs
  echo "[new-app/coolify-build] verify Amy tool contracts after authority sync"
  node ../packages/transovo-voice-v3-runtime/verify-astra-contracts-sync.mjs
fi

if [[ -n "${COOLIFY_RESOURCE_UUID:-}" ]]; then
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
fi

set -o pipefail
echo "[new-app/coolify-build] prisma generate start $(date -u +%Y-%m-%dT%H:%M:%SZ)"
$PNPM exec prisma generate --schema=prisma/schema.prisma
echo "[new-app/coolify-build] prisma generate end $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[new-app/coolify-build] next build start $(date -u +%Y-%m-%dT%H:%M:%SZ)"
$PNPM exec next build > >(stdbuf -oL -eL tee /tmp/new-app-next-build.log) 2>&1 &
build_pid=$!

while kill -0 "$build_pid" 2>/dev/null; do
  sleep "$heartbeat_interval"
  if kill -0 "$build_pid" 2>/dev/null; then
    echo "[new-app/coolify-build] still running... pid=$build_pid"
  fi
done

wait "$build_pid"
build_status=$?
echo "[new-app/coolify-build] next build end $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ "$build_status" -ne 0 ]]; then
  echo "[new-app/coolify-build] build failed with status $build_status"
  tail -n 40 /tmp/new-app-next-build.log 2>/dev/null || true
  exit "$build_status"
fi

if [[ ! -f .next/standalone/server.js ]]; then
  echo "[new-app/coolify-build] missing .next/standalone/server.js (check output: standalone in next.config)"
  exit 1
fi

cp -a public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -a .next/static .next/standalone/.next/static 2>/dev/null || true
mkdir -p .next/standalone/node_modules/.prisma .next/standalone/node_modules/@prisma
cp -a node_modules/.prisma/client .next/standalone/node_modules/.prisma/ 2>/dev/null || true
cp -a node_modules/@prisma/client .next/standalone/node_modules/@prisma/ 2>/dev/null || true
if [[ -d prisma ]]; then
  mkdir -p .next/standalone/prisma
  cp -a prisma/schema.prisma .next/standalone/prisma/
fi

echo "[new-app/coolify-build] complete"
