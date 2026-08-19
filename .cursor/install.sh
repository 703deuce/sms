#!/usr/bin/env bash
# One-time, idempotent repository bootstrap. Runs after checkout; with
# environment builds this is what populates the baseline snapshot.
#
# It installs Node dependencies, generates the Prisma client, and pre-pulls the
# Supabase container images so fresh agents start quickly. It does NOT leave any
# long-running process behind — the Docker daemon and Supabase stack are brought
# up per-boot by .cursor/start.sh.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=/dev/null
source ".cursor/lib.sh"

log "installing node dependencies (npm ci)"
npm ci

log "generating prisma client"
npm run db:generate

# Pre-pull Supabase images into the snapshot for fast boots. Best-effort: if
# nested Docker is unavailable during the build, start.sh will pull on first boot.
if start_docker; then
  if start_supabase; then
    log "supabase images ready; stopping stack (data recreated per-boot)"
    supabase stop --no-backup >/dev/null 2>&1 || true
  else
    log "WARN: supabase image pre-pull failed; will pull on first boot"
  fi
else
  log "WARN: docker unavailable during install; start.sh will handle it on boot"
fi

log "install complete"
