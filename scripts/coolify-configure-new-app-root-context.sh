#!/usr/bin/env bash
# Configure Coolify web app (ds8s3hjin60qs6g7s0iqkixs) for repo-root build context + shared prisma/.
# Run on the Coolify host (ssh coolify-server). Does not print secrets.
set -euo pipefail

APP_UUID="${COOLIFY_WEB_APP_UUID:-ds8s3hjin60qs6g7s0iqkixs}"
START_CMD="bash -lc 'cd new-app && node scripts/start-production.mjs'"

echo "Coolify web app UUID: ${APP_UUID}"
echo "Target base_directory: / (repository root)"
echo "Target start_command: ${START_CMD}"

docker exec coolify-db psql -U coolify -d coolify -c \
  "SELECT uuid, name, base_directory, build_pack, start_command FROM applications WHERE uuid = '${APP_UUID}';"

if [[ "${COOLIFY_APPLY:-}" != "1" ]]; then
  echo ""
  echo "Dry run only. To apply: COOLIFY_APPLY=1 bash $0"
  exit 0
fi

# SQL escape single quotes in start command
START_CMD_SQL="${START_CMD//\'/\'\'}"
docker exec coolify-db psql -U coolify -d coolify -c \
  "UPDATE applications SET base_directory = '/', start_command = '${START_CMD_SQL}' WHERE uuid = '${APP_UUID}';"

echo "Updated. Redeploy the web application from Coolify (or push master) and verify /api/health commitSha."
