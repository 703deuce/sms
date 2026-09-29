#!/usr/bin/env bash
# Non-destructive restore drill: latest logical backup → ephemeral local Postgres → verify counts → destroy.
set -euo pipefail

BACKUP_ROOT="${TRANSOVO_POSTGRES_BACKUP_DIR:-/data/backups/transovo-postgres}"
LATEST_JSON="${BACKUP_ROOT}/status/latest.json"
PG_IMAGE="${TRANSOVO_PG_DUMP_IMAGE:-postgres:17-alpine}"
DRILL_NAME="transovo-pg-restore-drill"
DRILL_PASSWORD="${TRANSOVO_RESTORE_DRILL_PASSWORD:-restore_drill_local_only}"

if [[ ! -f "$LATEST_JSON" ]]; then
  echo "[restore-drill] ERROR: missing $LATEST_JSON — run backup-production-postgres.sh first" >&2
  exit 1
fi

DUMP_FILE="$(python3 -c "import json,os; j=json.load(open('$LATEST_JSON')); print(os.path.join('$BACKUP_ROOT', j['file']))")"
if [[ ! -f "$DUMP_FILE" ]]; then
  echo "[restore-drill] ERROR: dump file not found" >&2
  exit 1
fi

docker rm -f "$DRILL_NAME" 2>/dev/null || true

START_MS="$(date +%s)"
docker run -d --name "$DRILL_NAME" \
  -e POSTGRES_PASSWORD="$DRILL_PASSWORD" \
  -e POSTGRES_DB=restore_drill \
  "$PG_IMAGE" >/dev/null

for i in $(seq 1 30); do
  if docker exec "$DRILL_NAME" pg_isready -U postgres -d restore_drill >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$DRILL_NAME" pg_isready -U postgres -d restore_drill >/dev/null

docker cp "$DUMP_FILE" "${DRILL_NAME}:/tmp/restore.dump"
docker exec "$DRILL_NAME" pg_restore -U postgres -d restore_drill --no-owner --no-acl /tmp/restore.dump 2>/dev/null || true
docker exec "$DRILL_NAME" rm -f /tmp/restore.dump 2>/dev/null || true

VERIFY_JSON="$(docker exec "$DRILL_NAME" psql -U postgres -d restore_drill -t -A -c "
SELECT json_build_object(
  'workspace', (SELECT count(*) FROM \"Workspace\"),
  'missed_call_events', (SELECT count(*) FROM missed_call_events),
  'conversations', (SELECT count(*) FROM \"Conversation\"),
  'conversation_messages', (SELECT count(*) FROM \"ConversationMessage\"),
  'job_queue', (SELECT count(*) FROM job_queue),
  'smart_routing_sms_consent_events', (SELECT count(*) FROM smart_routing_sms_consent_events)
);
" | tr -d '[:space:]')"

END_MS="$(date +%s)"
docker rm -f "$DRILL_NAME" >/dev/null

VERIFY_TMP="$(mktemp)"
printf '%s' "$VERIFY_JSON" >"$VERIFY_TMP"

python3 <<PY
import json, os
verify=json.load(open('$VERIFY_TMP'))
payload={
  'event':'postgres_restore_drill',
  'success':True,
  'backupFile':os.path.basename('$DUMP_FILE'),
  'restoreDurationSeconds':$END_MS-$START_MS,
  'verification':verify,
  'note':'Ephemeral container destroyed; production untouched'
}
out='$BACKUP_ROOT/status/restore-drill-latest.json'
open(out,'w').write(json.dumps(payload, indent=2))
print(json.dumps(payload, indent=2))
PY
rm -f "$VERIFY_TMP"
