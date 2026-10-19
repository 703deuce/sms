#!/usr/bin/env bash
# Apply committed Prisma migrations to a NEW empty Postgres (greenfield).
# Does not copy data from legacy. See docs/NEW-APP-DATABASE-GREENFIELD.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${GREENFIELD_DATABASE_URL:-}" ]]; then
  echo "[greenfield] ERROR: Set GREENFIELD_DATABASE_URL to the new empty database URI."
  echo "[greenfield] This script will NOT run against DATABASE_URL alone (prevents accidental prod wipe)."
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == "${GREENFIELD_DATABASE_URL}" ]]; then
  echo "[greenfield] Note: DATABASE_URL equals GREENFIELD_DATABASE_URL — migrations target greenfield only."
fi

# Block obvious mistake: same database path as legacy when legacy is set
if [[ -n "${LEGACY_DATABASE_URL:-}" && "${LEGACY_DATABASE_URL}" == "${GREENFIELD_DATABASE_URL}" ]]; then
  echo "[greenfield] ERROR: LEGACY_DATABASE_URL and GREENFIELD_DATABASE_URL are identical."
  exit 1
fi

if [[ -z "${GREENFIELD_ALLOW_LEGACY_HOST:-}" && -n "${LEGACY_DATABASE_URL:-}" ]]; then
  legacy_host="$(echo "$LEGACY_DATABASE_URL" | sed -E 's|^[^@]+@([^:/]+).*|\1|')"
  green_host="$(echo "$GREENFIELD_DATABASE_URL" | sed -E 's|^[^@]+@([^:/]+).*|\1|')"
  legacy_db="$(echo "$LEGACY_DATABASE_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
  green_db="$(echo "$GREENFIELD_DATABASE_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
  if [[ "$legacy_host" == "$green_host" && "$legacy_db" == "$green_db" ]]; then
    echo "[greenfield] ERROR: Legacy and greenfield appear to be the same host + database name."
    echo "[greenfield] Use a new Supabase project or CREATE DATABASE ...; or set GREENFIELD_ALLOW_LEGACY_HOST=1 if names differ in ways this check missed."
    exit 1
  fi
fi

echo "[greenfield] Applying schema to greenfield database..."
export DATABASE_URL="$GREENFIELD_DATABASE_URL"

# This repo's migration folder is incremental (post-baseline). Empty DBs need full
# schema from schema.prisma, then migration history marked applied for future deploys.
echo "[greenfield] prisma db push (materialize full schema)..."
npx prisma db push --skip-generate --accept-data-loss

echo "[greenfield] Baseline _prisma_migrations (mark committed migrations applied)..."
for dir in prisma/migrations/*/; do
  name="$(basename "$dir")"
  [[ "$name" == "migration_lock.toml" ]] && continue
  npx prisma migrate resolve --applied "$name" >/dev/null 2>&1 || true
done

echo "[greenfield] prisma migrate deploy (should be no-op)..."
bash scripts/deploy-db-migrations.sh

echo "[greenfield] Done. Run parity check:"
echo "  LEGACY_DATABASE_URL='...' GREENFIELD_DATABASE_URL='...' npm run db:verify-greenfield-parity"
