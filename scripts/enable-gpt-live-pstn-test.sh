#!/usr/bin/env bash
# Enable GPT-Live baseline on production test container (571 PSTN). No master deploy.
# Wrapper — see scripts/test-pstn-before-master.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec ./scripts/test-pstn-before-master.sh
