#!/usr/bin/env bash
#
# Cloud Agent start phase (runs on every boot, before terminals).
#
# Brings up the per-boot services the app needs and returns:
#   1. nested-VM bridge networking fix (container <-> container)
#   2. Docker daemon
#   3. local Supabase stack (Postgres + PostgREST/Kong)
#   4. Prisma schema push + PostgREST grants + demo seed (all idempotent)
#
# The dev server itself runs as a terminal (see .cursor/environment.json).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { echo "[start] $*"; }

# --- 1. Bridge networking ---------------------------------------------------
# In this nested VM, bridged container<->container traffic is dropped when it is
# routed through iptables. Exempt it so Kong/PostgREST can reach Postgres.
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 >/dev/null 2>&1 || true
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 >/dev/null 2>&1 || true

# --- 2. Docker daemon -------------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  log "Starting Docker daemon (logs: /var/log/cursor-dockerd.log)"
  # Log to a root-owned path: this sandboxed root lacks DAC_OVERRIDE, so it
  # cannot truncate a log file owned by another user.
  sudo rm -f /var/run/docker.pid >/dev/null 2>&1 || true
  sudo bash -c 'nohup dockerd >/var/log/cursor-dockerd.log 2>&1 &'
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  sudo chmod 666 /var/run/docker.sock >/dev/null 2>&1 || true
fi
docker info >/dev/null 2>&1 || { log "ERROR: Docker daemon did not start"; exit 1; }
log "Docker is up"

# --- 3. Local Supabase stack ------------------------------------------------
if supabase status >/dev/null 2>&1; then
  log "Supabase already running"
else
  log "Starting local Supabase stack"
  supabase start || { supabase stop --no-backup >/dev/null 2>&1 || true; supabase start; }
fi

# Wait for the database to accept connections.
for _ in $(seq 1 60); do
  docker exec supabase_db_sms pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

# --- 4. Schema + grants + seed (idempotent) ---------------------------------
log "Applying Prisma schema (db:push)"
npm run db:push -- --skip-generate

log "Granting PostgREST roles + reloading schema cache"
docker exec -i supabase_db_sms psql -U postgres -d postgres >/dev/null <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
SQL

# Seed the demo workspace only when it is missing. prisma/seed.ts generates a
# fresh user id on each run, so re-running it against an already-seeded database
# fails on the unique email constraint; guarding here keeps start idempotent.
demo_users="$(docker exec supabase_db_sms psql -U postgres -d postgres -tAc \
  "SELECT count(*) FROM \"User\" WHERE email='alex@harborhome.co'" 2>/dev/null || echo 0)"
if [ "${demo_users//[[:space:]]/}" = "0" ]; then
  log "Seeding demo workspace"
  set -a; . ./.env; set +a
  npm run db:seed
else
  log "Demo workspace already seeded — skipping"
fi

log "Start phase complete — app will be served by the 'dev' terminal on :3000"
