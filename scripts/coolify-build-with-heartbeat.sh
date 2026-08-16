#!/usr/bin/env bash
# Keep Coolify build logs alive during long silent next build phases.
# Validates output so hidden OOM kills (exit 0, missing .next) fail loudly.
set -euo pipefail

heartbeat_interval="${COOLIFY_BUILD_HEARTBEAT_SECS:-20}"

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"

echo "[coolify-build] starting next production build (turbopack default)"
echo "[coolify-build] node=$(node -v) heap_limit=${NODE_OPTIONS:-unset}"

set -o pipefail
npm run build > >(stdbuf -oL -eL tee /tmp/coolify-next-build.log) 2>&1 &
build_pid=$!

while kill -0 "$build_pid" 2>/dev/null; do
  sleep "$heartbeat_interval"
  if kill -0 "$build_pid" 2>/dev/null; then
    mem_kb="$(awk '/VmRSS/ {print $2; exit}' "/proc/$build_pid/status" 2>/dev/null || echo "?")"
    echo "[coolify-build] still running... pid=$build_pid rss_kb=${mem_kb}"
  fi
done

wait "$build_pid"
build_status=$?

if [[ "$build_status" -ne 0 ]]; then
  echo "[coolify-build] next build exited with status $build_status"
  if [[ "$build_status" -eq 137 ]]; then
    echo "[coolify-build] exit 137: process likely OOM-killed — raise VM RAM or lower NODE_OPTIONS heap"
  fi
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

echo "[coolify-build] installing Python voice runtime (post-build — avoids Turbopack .venv symlink trace)"
if bash scripts/install-voice-python-venv.sh; then
  echo "[coolify-build] Python venv installed"
  if bash scripts/check-voice-python.sh; then
    echo "[coolify-build] Python voice runtime checks passed"
  else
    echo "[coolify-build] ERROR: Python voice runtime checks failed"
    exit 1
  fi
else
  echo "[coolify-build] WARN: Python venv install failed — worker will fall back to typescript if configured"
fi

bundle_voice_python_runtime() {
  local dest_root="$1"
  if [[ ! -d voice-runtime-python/.venv ]]; then
    echo "[coolify-build] voice-runtime-python/.venv missing — Python worker will not start"
    return 0
  fi
  echo "[coolify-build] bundling Python voice runtime into ${dest_root}"
  mkdir -p "${dest_root}/voice-runtime-python"
  cp -a voice-runtime-python/.venv "${dest_root}/voice-runtime-python/.venv"
  cp -a voice-runtime-python/transovo_voice "${dest_root}/voice-runtime-python/transovo_voice"
  cp voice-runtime-python/pyproject.toml "${dest_root}/voice-runtime-python/pyproject.toml"
}

bundle_typescript_voice_runtime() {
  local dest_root="$1"
  if [[ ! -d voice-runtime/src ]]; then
    return 0
  fi
  echo "[coolify-build] bundling TypeScript voice runtime into ${dest_root}"
  mkdir -p "${dest_root}/voice-runtime"
  cp -a voice-runtime/src "${dest_root}/voice-runtime/src"
}

# Standalone server runs from .next/standalone — copy assets + voice runtimes there.
cp -a public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -a .next/static .next/standalone/.next/static 2>/dev/null || true
bundle_voice_python_runtime ".next/standalone"
bundle_typescript_voice_runtime ".next/standalone"

# Full-repo starts (npm start / next start) still need the venv at repo root.
if [[ ! -d voice-runtime-python/.venv ]]; then
  echo "[coolify-build] WARN: rebuild install phase if Python worker is required"
else
  echo "[coolify-build] Python venv present at voice-runtime-python/.venv"
fi

echo "[coolify-build] complete"
