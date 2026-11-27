#!/usr/bin/env bash
# Apply schema + storage buckets to a NEW Supabase project using production env names.
# Run on Coolify host (or anywhere with docker + network to Supabase).
#
#   cat > /root/new-supabase.env <<'EOF'
#   DATABASE_URL=postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres
#   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
#   SUPABASE_SERVICE_ROLE_KEY=<secret / service_role key>
#   EOF
#   chmod 600 /root/new-supabase.env
#   bash apply-new-supabase-credentials.sh /root/new-supabase.env
#
# Then update the same four keys in Coolify UI and redeploy the web app (+ workers).
set -euo pipefail

ENV_FILE="${1:-}"
if [[ -z "$ENV_FILE" || ! -f "$ENV_FILE" ]]; then
  echo "Usage: $0 /path/to/env-file" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

for key in DATABASE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  if [[ -z "${!key:-}" ]]; then
    echo "[apply-supabase] ERROR: missing $key in $ENV_FILE" >&2
    exit 1
  fi
done

if [[ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" && -z "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  echo "[apply-supabase] ERROR: set NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" >&2
  exit 1
fi

export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_IMAGE="${TRANSOVO_PG_DUMP_IMAGE:-postgres:17-alpine}"

echo "[apply-supabase] testing DATABASE_URL..."
PG_ENV="$(mktemp)"
chmod 600 "$PG_ENV"
python3 <<'PY' >"$PG_ENV"
import os
from urllib.parse import urlparse, unquote
raw = os.environ["DATABASE_URL"]
u = urlparse(raw.replace("postgresql://", "http://", 1))
print(f"PGHOST={u.hostname}")
print(f"PGPORT={u.port or 5432}")
print(f"PGUSER={unquote(u.username or '')}")
print(f"PGPASSWORD={unquote(u.password or '')}")
print(f"PGDATABASE={(u.path or '/postgres').lstrip('/')}")
print("PGSSLMODE=require")
PY

if ! docker run --rm --env-file "$PG_ENV" "$PG_IMAGE" psql -c "SELECT 1 AS ok;" >/dev/null; then
  echo "[apply-supabase] ERROR: cannot connect with DATABASE_URL from env file" >&2
  rm -f "$PG_ENV"
  exit 2
fi
rm -f "$PG_ENV"
echo "[apply-supabase] postgres connection OK"

cd "$ROOT"
if [[ ! -f package.json ]]; then
  echo "[apply-supabase] ERROR: repo root not found at $ROOT — copy scripts from git or set TRANSOVO_REPO_ROOT" >&2
  exit 3
fi

echo "[apply-supabase] prisma schema + buckets..."
bash scripts/operations/provision-fresh-supabase-project.sh

echo "[apply-supabase] storage inventory..."
NODE_OPTIONS="${NODE_OPTIONS:-} --import ./scripts/preload-server-only.mjs"
npx tsx scripts/operations/supabase-storage-inventory.ts

echo "[apply-supabase] success."
echo "[apply-supabase] Next: paste the SAME four keys into Coolify (ds8s3hjin60qs6g7s0iqkixs) and redeploy web + SMS worker."
