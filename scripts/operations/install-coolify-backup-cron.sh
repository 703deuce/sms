#!/usr/bin/env bash
# Install daily logical Postgres backup cron on Coolify host (idempotent).
set -euo pipefail

SCRIPT_DIR="${TRANSOVO_OPS_DIR:-/root/transovo-ops-scripts}"
CRON_LINE="15 3 * * * root ${SCRIPT_DIR}/backup-production-postgres.sh >> /var/log/transovo-postgres-backup.log 2>&1"
MARKER="# transovo-postgres-backup"

if [[ ! -x "${SCRIPT_DIR}/backup-production-postgres.sh" ]]; then
  echo "ERROR: missing ${SCRIPT_DIR}/backup-production-postgres.sh" >&2
  exit 1
fi

if grep -q "$MARKER" /etc/crontab 2>/dev/null; then
  echo "cron already installed"
else
  echo "${CRON_LINE} ${MARKER}" >> /etc/crontab
  echo "installed daily backup cron (03:15 UTC)"
fi
