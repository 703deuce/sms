#!/usr/bin/env bash
# Apply committed Prisma migrations to the target database (production/staging).
# Coolify: set DATABASE_URL on the web app so this runs on every deploy.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[db-deploy] DATABASE_URL is not set — skipping prisma migrate deploy (local/image build without DB)."
  exit 0
fi

echo "[db-deploy] Applying Prisma migrations..."
npx prisma migrate deploy
echo "[db-deploy] Database schema is up to date."
