#!/usr/bin/env bash
# Keep Coolify build logs alive during long silent next build phases.
# Validates output so hidden OOM kills (exit 0, missing .next) fail loudly.
set -euo pipefail

heartbeat_interval="${COOLIFY_BUILD_HEARTBEAT_SECS:-20}"

finish_worker_only_build() {
  echo "[coolify-build] COOLIFY_SKIP_NEXT_BUILD=1 — scheduler/worker image (no Next.js compile)"
  echo "[coolify-build] running prisma generate"
  npx prisma generate
  echo "[coolify-build] complete (worker-only — start with npm run worker:sms)"
}

if [[ "${COOLIFY_SKIP_NEXT_BUILD:-}" == "1" ]]; then
  finish_worker_only_build
  exit 0
fi

# Coolify: 6GB V8 heap — 4GB worker OOM on 8GB VMs (see jest-worker/processChild.js in build logs).
# webpackBuildWorker disabled in next.config when COOLIFY_RESOURCE_UUID is set.
if [[ -n "${COOLIFY_RESOURCE_UUID:-}" ]]; then
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
  build_cmd=(npx next build --webpack)
  build_mode="webpack (Coolify 6GB heap, no build worker)"
else
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
  build_cmd=(npm run build)
  build_mode="npm run build"
fi

echo "[coolify-build] starting next production build ($build_mode)"
echo "[coolify-build] node=$(node -v) heap_limit=${NODE_OPTIONS:-unset}"
if [[ -n "${COOLIFY_RESOURCE_UUID:-}" ]]; then
  echo "[coolify-build] COOLIFY_RESOURCE_UUID set — next.config skips in-build TypeScript (OOM guard; run tsc in CI)"
fi

set -o pipefail
"${build_cmd[@]}" > >(stdbuf -oL -eL tee /tmp/coolify-next-build.log) 2>&1 &
build_pid=$!

while kill -0 "$build_pid" 2>/dev/null; do
  sleep "$heartbeat_interval"
  if kill -0 "$build_pid" 2>/dev/null; then
    echo "[coolify-build] still running... pid=$build_pid"
  fi
done

wait "$build_pid"
build_status=$?

if [[ "$build_status" -ne 0 ]]; then
  echo "[coolify-build] next build exited with status $build_status"
  if [[ "$build_status" -eq 137 ]]; then
    echo "[coolify-build] exit 137: process likely SIGKILL (host/cgroup OOM)"
  elif grep -q "JavaScript heap out of memory" /tmp/coolify-next-build.log 2>/dev/null; then
    echo "[coolify-build] V8 heap exhaustion detected in build log — raise --max-old-space-size if still failing"
  fi
  tail -n 40 /tmp/coolify-next-build.log 2>/dev/null || true
  exit "$build_status"
fi

if [[ ! -d .next/server ]]; then
  echo "[coolify-build] build reported success but .next/server is missing (hidden OOM?)"
  tail -n 40 /tmp/coolify-next-build.log 2>/dev/null || true
  exit 1
fi

if [[ ! -f .next/standalone/server.js ]]; then
  echo "[coolify-build] standalone output missing at .next/standalone/server.js"
  exit 1
fi

# Standalone server runs from .next/standalone — copy assets only (no Python bundle).
cp -a public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -a .next/static .next/standalone/.next/static 2>/dev/null || true

echo "[coolify-build] complete (transovo-web — voice worker uses voice-runtime-python/Dockerfile)"
