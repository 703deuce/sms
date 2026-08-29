#!/usr/bin/env bash
# Keep Coolify build logs alive during long silent next build phases.
# Validates output so hidden OOM kills (exit 0, missing .next) fail loudly.
set -euo pipefail

heartbeat_interval="${COOLIFY_BUILD_HEARTBEAT_SECS:-20}"

# Coolify VMs often have 8GB host RAM but Docker build + npm ci + compile spikes past 3GB heap.
# Webpack production build uses less peak RAM than Next 16 Turbopack on constrained builders.
if [[ -n "${COOLIFY_RESOURCE_UUID:-}" ]]; then
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  build_cmd=(npx next build --webpack)
  build_mode="webpack (Coolify OOM guard)"
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

max_rss_kb=0

rss_for_pid() {
  awk '/VmRSS/ {print $2; exit}' "/proc/$1/status" 2>/dev/null || echo "0"
}

max_rss_in_tree() {
  local pid="$1"
  local rss total=0
  rss="$(rss_for_pid "$pid")"
  total=$((rss + 0))
  while read -r child; do
    [[ -z "$child" ]] && continue
    child_total="$(max_rss_in_tree "$child")"
    total=$((total + child_total))
  done < <(pgrep -P "$pid" 2>/dev/null || true)
  echo "$total"
}

while kill -0 "$build_pid" 2>/dev/null; do
  sleep "$heartbeat_interval"
  if kill -0 "$build_pid" 2>/dev/null; then
    tree_kb="$(max_rss_in_tree "$build_pid")"
    if [[ "$tree_kb" -gt "$max_rss_kb" ]]; then
      max_rss_kb="$tree_kb"
    fi
    echo "[coolify-build] still running... pid=$build_pid tree_rss_kb=${tree_kb} peak_tree_rss_kb=${max_rss_kb}"
  fi
done

wait "$build_pid"
build_status=$?

if [[ "$build_status" -ne 0 ]]; then
  echo "[coolify-build] next build exited with status $build_status (peak_tree_rss_kb=${max_rss_kb})"
  if [[ "$build_status" -eq 137 ]]; then
    echo "[coolify-build] exit 137: process likely OOM-killed"
    echo "[coolify-build] tips: add swap, stop other deploys, or set NODE_OPTIONS=--max-old-space-size=1536"
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

bundle_typescript_voice_runtime() {
  echo "[coolify-build] skipping TypeScript voice runtime bundle (Python-only voice worker)"
}

# Standalone server runs from .next/standalone — copy assets only (no Python bundle).
cp -a public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -a .next/static .next/standalone/.next/static 2>/dev/null || true
bundle_typescript_voice_runtime ".next/standalone"

echo "[coolify-build] complete (transovo-web only — voice worker uses voice-runtime-python/Dockerfile)"
