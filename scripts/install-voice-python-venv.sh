#!/usr/bin/env bash
# Install the minimal Python venv for the LiveKit voice worker.
# Must run AFTER next build in Docker — Turbopack traces .venv symlinks during compile.
set -euo pipefail

if [[ ! -f voice-runtime-python/pyproject.toml ]]; then
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
rm -rf voice-runtime-python/.venv
"$PYTHON_BIN" -m venv --copies voice-runtime-python/.venv
voice-runtime-python/.venv/bin/pip install --no-cache-dir --upgrade pip
voice-runtime-python/.venv/bin/pip install --no-cache-dir \
  "livekit-agents[openai]>=1.2.0,<2" \
  "livekit-plugins-noise-cancellation>=0.2,<0.4" \
  "httpx>=0.27,<0.29" \
  "pydantic>=2.7,<3" \
  "python-dotenv>=1.0,<2"
voice-runtime-python/.venv/bin/pip install --no-cache-dir -e ./voice-runtime-python
echo "[voice-python-install] Python voice runtime ready"
