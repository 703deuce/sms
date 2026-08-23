#!/usr/bin/env bash
# One-time, idempotent repository bootstrap. Runs after checkout; with
# environment builds this is what populates the baseline snapshot.
#
# Installs the system tooling (Docker engine, userspace overlay driver, Supabase
# CLI) if missing, installs Node dependencies, generates the Prisma client, and
# best-effort pre-pulls the Supabase container images so fresh agents boot fast.
# It never leaves a long-running process behind — Docker and the Supabase stack
# are (re)started per-boot by .cursor/start.sh.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=/dev/null
source ".cursor/lib.sh"

SUPABASE_CLI_VERSION="2.115.0"

ensure_system_deps() {
  local need_apt=0
  command -v docker >/dev/null 2>&1 || need_apt=1
  command -v fuse-overlayfs >/dev/null 2>&1 || need_apt=1
  if [ "$need_apt" = "1" ]; then
    log "installing system packages (docker, fuse-overlayfs, ...)"
    sudo apt-get update -qq || true
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --fix-missing \
      docker.io fuse-overlayfs uidmap iproute2 iptables \
      libvips42 postgresql-client ca-certificates curl git || \
      log "WARN: apt install reported issues; continuing (binaries may still be present)"
    sudo usermod -aG docker "$(id -un)" 2>/dev/null || true
  else
    log "system packages already present"
  fi

  if ! command -v supabase >/dev/null 2>&1; then
    log "installing supabase CLI ${SUPABASE_CLI_VERSION}"
    curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_amd64.tar.gz" \
      -o /tmp/supabase.tar.gz
    tar -xzf /tmp/supabase.tar.gz -C /tmp supabase
    sudo mv /tmp/supabase /usr/local/bin/supabase
    rm -f /tmp/supabase.tar.gz
  else
    log "supabase CLI already present ($(supabase --version 2>/dev/null))"
  fi
}

ensure_system_deps

log "installing node dependencies (npm ci)"
npm ci

log "generating prisma client"
npm run db:generate

# Pre-pull Supabase images into the snapshot for fast boots. Best-effort: if
# nested Docker is unavailable during the build, start.sh pulls on first boot.
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
