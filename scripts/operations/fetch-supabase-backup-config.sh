#!/usr/bin/env bash
# Fetch Supabase managed backup + PITR config via Management API (no secrets in output).
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-azurgysigroeizdrlxgx}"
COOLIFY_ENV="${COOLIFY_APP_ENV_FILE:-/data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env}"
OUT="${TRANSOVO_SUPABASE_BACKUP_STATUS_JSON:-/data/backups/transovo-postgres/status/supabase-managed-backups.json}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]] && [[ -f "$COOLIFY_ENV" ]]; then
  SUPABASE_ACCESS_TOKEN="$(grep -m1 '^SUPABASE_ACCESS_TOKEN=' "$COOLIFY_ENV" 2>/dev/null | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true)"
  export SUPABASE_ACCESS_TOKEN
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  python3 -c "
import json
print(json.dumps({
  'event':'supabase_managed_backup_status',
  'accessible':False,
  'reason':'SUPABASE_ACCESS_TOKEN not configured in environment or Coolify app .env',
  'projectRef':'$REF',
  'operatorAction':'SUPABASE_OWNER_ACTION_REQUIRED — add personal access token to Coolify env as SUPABASE_ACCESS_TOKEN (Supabase Dashboard → Account → Access Tokens) so automation can read backup/PITR state and enable PITR if included in plan'
}, indent=2))
"
  exit 0
fi

API="https://api.supabase.com/v1/projects/${REF}"
HDR=( -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H "Content-Type: application/json" )

PROJECT="$(curl -sS "${HDR[@]}" "$API")"
BACKUPS="$(curl -sS "${HDR[@]}" "$API/database/backups" 2>/dev/null || echo '{}')"
PITR="$(curl -sS "${HDR[@]}" "$API/database/pitr" 2>/dev/null || echo '{}')"

export OUT REF
export PROJECT_JSON="$PROJECT"
export BACKUPS_JSON="$BACKUPS"
export PITR_JSON="$PITR"
python3 <<'PY'
import json, os, re
from datetime import datetime, timezone

def redact(o):
    if not isinstance(o, dict):
        return o
    c = dict(o)
    for k in list(c.keys()):
        if re.search(r"key|token|secret|password", k, re.I):
            c[k] = "<redacted>"
    return c

project = json.loads(os.environ["PROJECT_JSON"])
backups = json.loads(os.environ["BACKUPS_JSON"])
pitr = json.loads(os.environ["PITR_JSON"])
payload = {
    "event": "supabase_managed_backup_status",
    "accessible": True,
    "projectRef": project.get("id") or os.environ["REF"],
    "name": project.get("name"),
    "region": project.get("region"),
    "database": redact(project.get("database") or {}),
    "plan": project.get("plan") or project.get("organization_plan") or project.get("billing_plan") or "unknown",
    "backups": backups,
    "pitr": pitr,
    "fetchedAt": datetime.now(timezone.utc).isoformat(),
}
out = os.environ["OUT"]
with open(out, "w") as f:
    json.dump(payload, f, indent=2)
print(json.dumps(payload, indent=2))
PY
