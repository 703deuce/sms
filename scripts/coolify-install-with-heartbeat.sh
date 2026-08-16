#!/usr/bin/env bash
# npm ci can run silently for minutes; Coolify may kill quiet build steps.
# Keep logs alive and use conservative npm parallelism on small build VMs.
set -euo pipefail

heartbeat_interval="${COOLIFY_INSTALL_HEARTBEAT_SECS:-15}"

# Reserve V8 heap for next build — npm ci should not inherit a 3GB heap on 4GB VMs.
unset NODE_OPTIONS
export NPM_CONFIG_MAXSOCKETS="${NPM_CONFIG_MAXSOCKETS:-2}"
export NPM_CONFIG_FETCH_RETRIES="${NPM_CONFIG_FETCH_RETRIES:-5}"
export NPM_CONFIG_FETCH_RETRY_MINTIMEOUT="${NPM_CONFIG_FETCH_RETRY_MINTIMEOUT:-20000}"

echo "[coolify-install] starting npm ci (maxsockets=${NPM_CONFIG_MAXSOCKETS})"
echo "[coolify-install] node=$(node -v) npm=$(npm -v)"

set -o pipefail
npm ci > >(stdbuf -oL -eL tee /tmp/coolify-npm-ci.log) 2>&1 &
install_pid=$!

while kill -0 "$install_pid" 2>/dev/null; do
  sleep "$heartbeat_interval"
  if kill -0 "$install_pid" 2>/dev/null; then
    mem_kb="$(awk '/VmRSS/ {print $2; exit}' "/proc/$install_pid/status" 2>/dev/null || echo "?")"
    echo "[coolify-install] still running... pid=$install_pid rss_kb=${mem_kb}"
  fi
done

wait "$install_pid"
install_status=$?

if [[ "$install_status" -ne 0 ]]; then
  echo "[coolify-install] npm ci exited with status $install_status"
  if [[ "$install_status" -eq 137 ]]; then
    echo "[coolify-install] exit 137: process likely OOM-killed — raise VM RAM"
  fi
  tail -n 60 /tmp/coolify-npm-ci.log 2>/dev/null || true
  exit "$install_status"
fi

if [[ ! -d node_modules ]]; then
  echo "[coolify-install] npm ci finished but node_modules is missing"
  exit 1
fi

echo "[coolify-install] complete"
echo "[coolify-install] Python venv is installed after next build (see coolify-build-with-heartbeat.sh)"
