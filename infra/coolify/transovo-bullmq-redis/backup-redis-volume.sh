#!/usr/bin/env bash
# Local volume backup (on Coolify host). Off-host copy requires operator destination — see runbook.
set -euo pipefail
BACKUP_ROOT="${BACKUP_ROOT:-/data/backups/transovo-redis}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
VOL="transovo-bullmq-redis_transovo-bullmq-redis-data"
mkdir -p "$BACKUP_ROOT"
OUT="$BACKUP_ROOT/redis-aof-snapshot-$STAMP.tar.gz"
docker run --rm \
  -v "${VOL}:/data:ro" \
  -v "${BACKUP_ROOT}:/backup" \
  alpine:3.20 \
  sh -c "cd /data && tar czf /backup/$(basename "$OUT") ."
find "$BACKUP_ROOT" -name 'redis-aof-snapshot-*.tar.gz' -mtime +7 -delete 2>/dev/null || true
echo "backup_written=$OUT"
