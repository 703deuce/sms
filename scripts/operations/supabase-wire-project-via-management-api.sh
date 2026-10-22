#!/usr/bin/env bash
# Wire a Supabase project using the Management API (account-level PAT).
# Requires SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)
# with at least: projects read, database_config_write, api_keys read (or classic PAT).
#
#   export SUPABASE_ACCESS_TOKEN='sbp_...'
#   export SUPABASE_PROJECT_REF='ztccppxodhgdyejkuuax'
#   export SUPABASE_DB_PASSWORD='...'   # optional; resets DB password when set
#   bash scripts/operations/supabase-wire-project-via-management-api.sh
#
# Outputs (stdout): NEXT_PUBLIC_SUPABASE_URL, keys, DATABASE_URL — redirect to Coolify update script.
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-}"
TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
API="${SUPABASE_API_BASE:-https://api.supabase.com}"
DB_PASS="${SUPABASE_DB_PASSWORD:-}"

if [[ -z "$TOKEN" ]]; then
  echo "[supabase-wire] ERROR: set SUPABASE_ACCESS_TOKEN (account personal access token)" >&2
  exit 1
fi
if [[ -z "$REF" ]]; then
  echo "[supabase-wire] ERROR: set SUPABASE_PROJECT_REF" >&2
  exit 1
fi

api() {
  local method="$1" path="$2"
  shift 2
  curl -sS -X "$method" "${API}${path}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "$@"
}

echo "[supabase-wire] project=${REF}"

if [[ -n "$DB_PASS" ]]; then
  echo "[supabase-wire] resetting database password..."
  export SUPABASE_DB_PASSWORD="$DB_PASS"
  api PATCH "/v1/projects/${REF}/database/password" -d "$(python3 -c "import json,os; print(json.dumps({'password': os.environ['SUPABASE_DB_PASSWORD']}))")" \
    | python3 -c "import sys,json; json.load(sys.stdin); print('[supabase-wire] password reset OK')"
fi

echo "[supabase-wire] fetching pooler config..."
POOLER_JSON="$(api GET "/v1/projects/${REF}/config/database/pooler")"
PASS_FOR_URL="$DB_PASS"
if [[ -z "$PASS_FOR_URL" ]]; then
  echo "[supabase-wire] ERROR: set SUPABASE_DB_PASSWORD (or pass after reset) to build DATABASE_URL" >&2
  exit 2
fi

export POOLER_JSON REF PASS_FOR_URL
DATABASE_URL="$(python3 <<'PY'
import json, os, urllib.parse
raw = json.loads(os.environ["POOLER_JSON"])
rows = raw if isinstance(raw, list) else [raw]
# Prefer session pooler :5432 for Prisma migrate; else first row from API.
pooler = next((r for r in rows if r.get("pool_mode") == "session"), None)
if pooler is None:
    pooler = next((r for r in rows if r.get("db_port") == 5432), rows[0])
ref = os.environ["REF"]
user = pooler.get("db_user") or f"postgres.{ref}"
host = pooler["db_host"]
port = pooler.get("db_port") or 5432
db = pooler.get("db_name") or "postgres"
pw = urllib.parse.quote(os.environ["PASS_FOR_URL"], safe="")
q = "sslmode=require"
if pooler.get("pool_mode") == "transaction" or port == 6543:
    q += "&pgbouncer=true"
print(f"postgresql://{user}:{pw}@{host}:{port}/{db}?{q}")
PY
)"
export DATABASE_URL

echo "[supabase-wire] fetching API keys (reveal)..."
KEYS_JSON="$(api GET "/v1/projects/${REF}/api-keys?reveal=true")"
export KEYS_JSON

python3 <<'PY'
import json, os
keys = json.loads(os.environ["KEYS_JSON"])
ref = os.environ["REF"]
publishable = secret = anon = service = None
for row in keys if isinstance(keys, list) else keys.get("data", keys):
    if not isinstance(row, dict):
        continue
    name = (row.get("name") or row.get("type") or "").lower()
    val = row.get("api_key") or row.get("key") or row.get("token")
    typ = (row.get("type") or "").lower()
    if not val:
        continue
    if typ == "publishable" or "publishable" in name or (val.startswith("sb_publishable_")):
        publishable = val
    if typ == "secret" or "secret" in name or val.startswith("sb_secret_"):
        secret = val
    if val.startswith("eyJ") and row.get("role") == "service_role":
        service = val
    if val.startswith("eyJ") and row.get("role") == "anon":
        anon = val
client = publishable or anon
server = secret or service
print("NEXT_PUBLIC_SUPABASE_URL=https://{}.supabase.co".format(ref))
print("DATABASE_URL=" + os.environ["DATABASE_URL"])
if client:
    print("NEXT_PUBLIC_SUPABASE_ANON_KEY=" + client)
if server:
    print("SUPABASE_SERVICE_ROLE_KEY=" + server)
if not server:
    print("# WARNING: no secret/service_role key in API response — create in Dashboard → API Keys", file=__import__("sys").stderr)
PY

echo "[supabase-wire] done. Pipe lines above into coolify-update-supabase-env.sh or Coolify UI."
