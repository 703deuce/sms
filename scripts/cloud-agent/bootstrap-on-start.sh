#!/usr/bin/env bash
# Cloud Agent start hook: tunnel + /workspace/.env (required for BullMQ tests).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! ssh -o BatchMode=yes -o ConnectTimeout=15 "${COOLIFY_SSH_HOST:-coolify-server}" true 2>/dev/null; then
  echo "bootstrap-on-start: coolify-server SSH unavailable — cannot reach self-hosted Redis" >&2
  exit 1
fi

# shellcheck source=scripts/cloud-agent/ensure-self-hosted-redis-env.sh
source "$ROOT/scripts/cloud-agent/ensure-self-hosted-redis-env.sh"
# shellcheck source=scripts/cloud-agent/ensure-local-test-database.sh
source "$ROOT/scripts/cloud-agent/ensure-local-test-database.sh"

MARKER="# transovo-self-hosted-redis (managed)"
for rc in /home/ubuntu/.bashrc /home/ubuntu/.profile; do
  if [[ -f "$rc" ]] && ! grep -q "$MARKER" "$rc" 2>/dev/null; then
    cat >>"$rc" <<EOF

$MARKER
[ -f /workspace/.env ] && set -a && . /workspace/.env && set +a
EOF
  fi
done

echo "bootstrap-on-start: self-hosted Redis ready"
