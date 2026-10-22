#!/usr/bin/env bash
# After creating a NEW Supabase project: apply Prisma schema + ensure Storage buckets.
# Run from repo root with env pointing at the NEW project only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${GREENFIELD_DATABASE_URL:-}" ]]; then
  echo "[fresh-supabase] ERROR: Set GREENFIELD_DATABASE_URL to the new project's Session pooler URI."
  exit 1
fi
if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "[fresh-supabase] ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for bucket creation."
  exit 1
fi

echo "[fresh-supabase] Step 1/2: Prisma schema on empty database..."
GREENFIELD_ALLOW_LEGACY_HOST=1 bash scripts/operations/provision-greenfield-database.sh

echo "[fresh-supabase] Step 2/2: Storage buckets..."
NODE_OPTIONS="${NODE_OPTIONS:-} --import ./scripts/preload-server-only.mjs"
npx tsx scripts/operations/ensure-all-supabase-storage-buckets.ts

echo "[fresh-supabase] Done. Update Coolify DATABASE_URL to GREENFIELD_DATABASE_URL and redeploy."
