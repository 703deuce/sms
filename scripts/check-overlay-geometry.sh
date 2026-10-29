#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cmp "${REPO_ROOT}/new-app/lib/clips/overlay-geometry.json" "${REPO_ROOT}/worker/clips_worker/overlay_geometry.json"
cmp "${REPO_ROOT}/new-app/tests/fixtures/layers_sync_cases.json" "${REPO_ROOT}/worker/tests/fixtures/layers_sync_cases.json"
echo "[check-overlay-geometry] ok"
