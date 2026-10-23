#!/usr/bin/env bash
# Cloud Agent: never run tests/migrations against production Supabase by default.
# Sources local Postgres URL when DATABASE_URL is unset or points at Supabase pooler.
set -euo pipefail

LOCAL_DB_NAME="${CLOUD_AGENT_TEST_DB_NAME:-pd_agent_test}"
LOCAL_DB_USER="${CLOUD_AGENT_TEST_DB_USER:-postgres}"
LOCAL_DB_PASS="${CLOUD_AGENT_TEST_DB_PASS:-pdlocal}"
LOCAL_DB_HOST="${CLOUD_AGENT_TEST_DB_HOST:-127.0.0.1}"
LOCAL_DB_PORT="${CLOUD_AGENT_TEST_DB_PORT:-5432}"

is_prod_like_url() {
  local url="${1:-}"
  [[ "$url" == *"supabase.co"* || "$url" == *"pooler.supabase.com"* ]]
}

ensure_postgres() {
  if command -v pg_isready >/dev/null 2>&1; then
    if ! pg_isready -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -q 2>/dev/null; then
      sudo service postgresql start 2>/dev/null || sudo pg_ctlcluster 16 main start 2>/dev/null || true
    fi
  fi
  if command -v sudo >/dev/null 2>&1 && command -v psql >/dev/null 2>&1; then
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${LOCAL_DB_NAME}'" | grep -q 1 \
      || sudo -u postgres psql -c "CREATE DATABASE \"${LOCAL_DB_NAME}\" OWNER postgres;" 2>/dev/null || true
  fi
}

ensure_postgres

LOCAL_URL="postgresql://${LOCAL_DB_USER}:${LOCAL_DB_PASS}@${LOCAL_DB_HOST}:${LOCAL_DB_PORT}/${LOCAL_DB_NAME}?schema=public"

if is_prod_like_url "${DATABASE_URL:-}"; then
  echo "ensure-local-test-database: clearing prod-like DATABASE_URL (use local Postgres for tests)." >&2
  unset DATABASE_URL
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="$LOCAL_URL"
  echo "ensure-local-test-database: DATABASE_URL set to local test database (${LOCAL_DB_NAME})."
fi
