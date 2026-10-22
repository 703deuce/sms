#!/usr/bin/env bash
# Install supabase-production-cleanup.sh on Coolify host (run as root on server).
set -euo pipefail

OPS_DIR="${TRANSOVO_OPS_DIR:-/root/transovo-ops-scripts}"
SRC="${1:-}"

if [[ -z "$SRC" ]]; then
  echo "Usage: $0 /path/to/supabase-production-cleanup.sh" >&2
  exit 1
fi

mkdir -p "$OPS_DIR"
install -m 755 "$SRC" "${OPS_DIR}/supabase-production-cleanup.sh"
echo "Installed ${OPS_DIR}/supabase-production-cleanup.sh"
echo "Dry run: ${OPS_DIR}/supabase-production-cleanup.sh"
echo "Execute: ${OPS_DIR}/supabase-production-cleanup.sh --execute --aggressive"
