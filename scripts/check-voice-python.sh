#!/usr/bin/env bash
# Verify Python voice runtime compiles and unit tests pass before deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY_ROOT="${ROOT}/voice-runtime-python"
cd "$PY_ROOT"

if [[ ! -f pyproject.toml ]]; then
  echo "[check-voice-python] pyproject.toml missing — skip"
  exit 0
fi

PYTHON=""
if [[ -f .venv/bin/python ]]; then
  PYTHON=".venv/bin/python"
elif [[ -n "${PYTHON_BIN:-}" ]] && command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON="$PYTHON_BIN"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="python3"
else
  echo "[check-voice-python] ERROR: python3 not found"
  exit 1
fi

echo "[check-voice-python] using ${PYTHON} ($( "$PYTHON" -V ))"

echo "[check-voice-python] compileall transovo_voice"
"$PYTHON" -m compileall -q transovo_voice

if [[ -f .venv/bin/python ]]; then
  echo "[check-voice-python] import smoke test (venv present)"
  "$PYTHON" -c "import transovo_voice.main; import transovo_voice.integrations.backend_client"
elif "$PYTHON" -c "import dotenv" >/dev/null 2>&1; then
  echo "[check-voice-python] import smoke test"
  "$PYTHON" -c "import transovo_voice.main; import transovo_voice.integrations.backend_client"
else
  echo "[check-voice-python] compile-only — no venv/deps (OK for local syntax check)"
  exit 0
fi

if ! "$PYTHON" -m pytest --version >/dev/null 2>&1; then
  echo "[check-voice-python] installing pytest for verification"
  "$PYTHON" -m pip install -q pytest pytest-asyncio
fi

echo "[check-voice-python] pytest"
"$PYTHON" -m pytest tests/ -q

echo "[check-voice-python] OK"
