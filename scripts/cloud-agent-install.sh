#!/usr/bin/env bash
#
# Cloud Agent install phase (runs once after checkout / during environment build).
#
# Installs durable, source-derived state only:
#   - system packages (Docker + fuse-overlayfs, Supabase CLI)
#   - Docker daemon config tuned for this nested VM
#   - Node dependencies + generated Prisma client
#   - a local-dev .env pointing at the local Supabase stack
#
# Per-boot services (Docker daemon, Supabase stack, schema/seed) live in
# scripts/cloud-agent-start.sh so they are re-established on every boot.
#
# Safe to run repeatedly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SUPABASE_CLI_VERSION="2.112.0"

log() { echo "[install] $*"; }

# --- 1. System packages -----------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker + fuse-overlayfs"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    docker.io fuse-overlayfs uidmap
else
  log "Docker already installed"
fi

if ! command -v supabase >/dev/null 2>&1; then
  log "Installing Supabase CLI v${SUPABASE_CLI_VERSION}"
  arch="$(dpkg --print-architecture)"
  tmp_deb="$(mktemp --suffix=.deb)"
  curl -fsSL -o "$tmp_deb" \
    "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_${arch}.deb"
  sudo dpkg -i "$tmp_deb"
  rm -f "$tmp_deb"
else
  log "Supabase CLI already installed ($(supabase --version 2>/dev/null || echo unknown))"
fi

# --- 2. Docker daemon config (nested-VM friendly) ---------------------------
# The default overlayfs/containerd snapshotter cannot mount overlay-on-overlay
# in this nested VM, so use the fuse-overlayfs storage driver instead.
log "Writing /etc/docker/daemon.json"
sudo mkdir -p /etc/docker
printf '{\n  "features": { "containerd-snapshotter": false },\n  "storage-driver": "fuse-overlayfs"\n}\n' \
  | sudo tee /etc/docker/daemon.json >/dev/null

# --- 3. Node dependencies + Prisma client -----------------------------------
log "Installing Node dependencies (npm ci)"
npm ci

log "Generating Prisma client"
npm run db:generate

# --- 4. Local-dev .env ------------------------------------------------------
# Points the app at the local Supabase stack started by cloud-agent-start.sh.
# The anon/service_role keys are HS256 JWTs signed with the well-known Supabase
# local JWT secret, so they are deterministic and stable across restarts.
if [ ! -f .env ]; then
  log "Generating .env for local Supabase"
  keys="$(node scripts/supabase-local-keys.mjs)"
  anon="$(printf '%s\n' "$keys" | sed -n 's/^ANON=//p')"
  service="$(printf '%s\n' "$keys" | sed -n 's/^SERVICE=//p')"
  cat > .env <<EOF
# Local development environment (Cloud Agent) — local Supabase stack.
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Local Supabase (see scripts/cloud-agent-start.sh -> supabase start)
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="${anon}"
SUPABASE_SERVICE_ROLE_KEY="${service}"

# Postgres (Prisma schema push) — local Supabase database
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Messaging provider: mock (no external credentials needed for local dev)
MESSAGING_PROVIDER=mock

# Cron auth for POST /api/jobs/process (dev value)
CRON_SECRET="dev-cron-secret"
EOF
else
  log ".env already present — leaving it untouched"
fi

log "Install phase complete"
