#!/usr/bin/env bash
# Combined per-boot entrypoint: bring up the local Supabase stack, then run the
# Next.js dev server attached in the foreground. Suitable as a Cloud Agent
# `start` command for db-managed environments that have no separate `terminals`.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/start.sh"
exec bash "$SCRIPT_DIR/dev.sh"
