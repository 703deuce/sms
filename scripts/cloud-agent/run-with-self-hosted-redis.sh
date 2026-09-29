#!/usr/bin/env bash
# Prefer Coolify self-hosted Redis when SSH to coolify-server works (Cloud Agent).
set -euo pipefail
if ssh -o BatchMode=yes -o ConnectTimeout=5 "${COOLIFY_SSH_HOST:-coolify-server}" true 2>/dev/null; then
  # shellcheck source=/dev/null
  source "$(dirname "$0")/ensure-self-hosted-redis-env.sh"
fi
exec "$@"
