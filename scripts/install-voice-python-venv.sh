#!/usr/bin/env bash
# Install the minimal Python venv for the LiveKit voice worker.
# Must run AFTER next build in Docker — Turbopack traces .venv symlinks during compile.
# Paths are resolved from this script's location (repo root), not the caller's cwd.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY_ROOT="${ROOT}/voice-runtime-python"

if [[ ! -f "$PY_ROOT/pyproject.toml" ]]; then
  echo "[voice-python-install] pyproject.toml missing — skip"
  exit 0
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "[voice-python-install] ERROR: python3 not found — set VOICE_RUNTIME_IMPL=typescript or install python3"
  exit 1
fi
if ! "$PYTHON_BIN" -m venv --help >/dev/null 2>&1; then
  echo "[voice-python-install] ERROR: python3-venv missing"
  exit 1
fi

echo "[voice-python-install] creating venv (--copies for container portability)"
rm -rf "$PY_ROOT/.venv"
"$PYTHON_BIN" -m venv --copies "$PY_ROOT/.venv"
"$PY_ROOT/.venv/bin/pip" install --no-cache-dir --upgrade pip
"$PY_ROOT/.venv/bin/pip" install --no-cache-dir \
  "livekit-agents[openai]>=1.2.0,<2" \
  "livekit-plugins-noise-cancellation>=0.2,<0.4" \
  "httpx>=0.27,<0.29" \
  "pydantic>=2.7,<3" \
  "python-dotenv>=1.0,<2"
"$PY_ROOT/.venv/bin/pip" install --no-cache-dir -e "$PY_ROOT"
echo "[voice-python-install] Python voice runtime ready"
