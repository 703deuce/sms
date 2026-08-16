#!/usr/bin/env bash
# Compile + test Python voice runtime before push (same role as next build for TS).
# Run: npm run build:voice-python
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY_ROOT="${ROOT}/voice-runtime-python"
cd "$PY_ROOT"

if [[ ! -f pyproject.toml ]]; then
  echo "[build-voice-python] pyproject.toml missing — skip"
  exit 0
fi

if [[ ! -f .venv/bin/python ]]; then
  echo "[build-voice-python] venv missing — installing (first run)"
  bash "${ROOT}/scripts/install-voice-python-venv.sh"
fi

PYTHON=".venv/bin/python"
echo "[build-voice-python] using ${PYTHON} ($( "$PYTHON" -V ))"

echo "[build-voice-python] compileall transovo_voice"
"$PYTHON" -m compileall -q transovo_voice

echo "[build-voice-python] import smoke test"
"$PYTHON" -c "import transovo_voice.main; import transovo_voice.integrations.backend_client"

if ! "$PYTHON" -m pytest --version >/dev/null 2>&1; then
  echo "[build-voice-python] installing pytest"
  "$PYTHON" -m pip install -q pytest pytest-asyncio
fi

echo "[build-voice-python] pytest"
"$PYTHON" -m pytest tests/ -q

echo "[build-voice-python] OK"
