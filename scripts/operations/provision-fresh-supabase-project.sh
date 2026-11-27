#!/usr/bin/env bash
# After creating a NEW Supabase project: apply Prisma schema + ensure Storage buckets.
# Uses the same env names as Coolify production — only values change for the new project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[fresh-supabase] ERROR: Set DATABASE_URL (Session pooler URI for the new Supabase project)."
  exit 1
fi
if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "[fresh-supabase] ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  exit 1
fi

echo "[fresh-supabase] Step 1/2: Prisma schema on empty database (target = DATABASE_URL)..."
# provision-greenfield-database.sh expects GREENFIELD_DATABASE_URL as an internal guard name only.
export GREENFIELD_DATABASE_URL="$DATABASE_URL"
GREENFIELD_ALLOW_LEGACY_HOST=1 bash scripts/operations/provision-greenfield-database.sh

echo "[fresh-supabase] Step 2/2: Storage buckets..."
NODE_OPTIONS="${NODE_OPTIONS:-} --import ./scripts/preload-server-only.mjs"
npx tsx scripts/operations/ensure-all-supabase-storage-buckets.ts

echo "[fresh-supabase] Done. Coolify already uses these same variable names — redeploy web/workers if you updated env in the UI."
