#!/usr/bin/env bash
# Queue a Coolify deployment for transovo-sms-worker (application id 3).
# Run on the Coolify host as root, or via: ssh coolify-server 'bash -s' < scripts/coolify-queue-sms-worker-deploy.sh
set -euo pipefail

COMMIT="${1:-${GITHUB_SHA:-${SOURCE_COMMIT:-HEAD}}}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export VOICE_GIT_COMMIT="$COMMIT"
bash scripts/coolify-restore-transovo-voice-worker.sh --deploy-sms

echo "[coolify-sms-worker] queued deploy for commit=${COMMIT}"
