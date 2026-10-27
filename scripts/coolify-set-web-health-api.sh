#!/usr/bin/env bash
# Point web app health check at /api/health (DB-ready) to avoid 502 during deploy overlap.
# Run on Coolify host: bash scripts/coolify-set-web-health-api.sh
set -euo pipefail
WEB_APP_ID="${WEB_APP_ID:-1}"
docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 -c "
  UPDATE applications SET
    health_check_path = '/api/health',
    health_check_port = '3000',
    health_check_return_code = '200',
    updated_at = NOW()
  WHERE id = ${WEB_APP_ID};
"
echo "[coolify-web-health] application_id=${WEB_APP_ID} health_check_path=/api/health"
