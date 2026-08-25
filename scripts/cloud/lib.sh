#!/usr/bin/env bash
# Shared helpers + configuration for the Cloud Agent local development stack.
#
# The Transovo web app talks to a Supabase-compatible REST endpoint at runtime
# (see src/lib/supabase/prisma-compat.ts) and uses Prisma only for schema push.
# For a fully local, external-SaaS-free dev environment we run:
#   - PostgreSQL           (data + Prisma `db push` target)
#   - PostgREST            (serves the public schema over HTTP, like Supabase)
#   - nginx                (reverse proxy that emulates Supabase's /rest/v1 route)
#
# All state lives under $TRANSOVO_HOME so it is captured in the environment
# snapshot and reused on every boot without re-running one-time setup.
set -euo pipefail

export TRANSOVO_HOME="${TRANSOVO_HOME:-$HOME/.transovo}"
export PGDATA="${PGDATA:-$TRANSOVO_HOME/pgdata}"
export PGHOST="127.0.0.1"
export PGPORT="5432"
PGREST_PORT="3001"
SUPABASE_PORT="54321"

# Well-known local demo JWTs signed with the jwt-secret below. Not secret; local only.
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.F_rDxRTPE8OU83L_CNgEGXfmirMXmMMugT29Cvc8ygQ"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.5z-pJI1qwZg1LE5yavGLqum65WOnnaaI5eZ3V00pLww"

# Local, non-secret development values (localhost + a throwaway local cluster).
# These are intentionally generic dev defaults, not real credentials.
LOCAL_APP_URL="http://localhost:3000"  # pragma: allowlist secret
LOCAL_SUPABASE_URL="http://127.0.0.1:${SUPABASE_PORT}"
LOCAL_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PGPORT}/postgres?schema=public"  # pragma: allowlist secret
LOCAL_CRON_SECRET="local-dev-cron-secret"  # pragma: allowlist secret

repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

pg_bindir() {
  local d
  d="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [ -z "$d" ]; then
    echo "PostgreSQL server binaries not found under /usr/lib/postgresql/*/bin" >&2
    return 1
  fi
  echo "$d"
}

pg() { "$(pg_bindir)/$1" "${@:2}"; }

pg_running() {
  "$(pg_bindir)/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1
}

wait_for_pg() {
  local tries=60
  while [ "$tries" -gt 0 ]; do
    if "$(pg_bindir)/pg_isready" -h "$PGHOST" -p "$PGPORT" -q; then return 0; fi
    tries=$((tries - 1)); sleep 1
  done
  echo "Postgres did not become ready in time" >&2
  return 1
}

psql_super() {
  "$(pg_bindir)/psql" -h "$PGHOST" -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}
