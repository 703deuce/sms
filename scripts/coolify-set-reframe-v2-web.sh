#!/usr/bin/env bash
# Enable REFRAME_V2_ENABLED on Coolify web app 1 only (not worker).
set -euo pipefail
APP_ID="${COOLIFY_APP_ID:-ds8s3hjin60qs6g7s0iqkixs}"
TOKEN_FILE="${HOME}/.coolify-api-token"
[[ -f "$TOKEN_FILE" ]] || { echo "FATAL: missing $TOKEN_FILE" >&2; exit 1; }
python3 - "$APP_ID" "$(cat "$TOKEN_FILE")" <<'PY'
import json, sys, urllib.request
app_id, token = sys.argv[1:3]
base = f"http://localhost:8000/api/v1/applications/{app_id}"

def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{base}{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()

envs = json.loads(api("GET", "/envs"))
for e in envs:
    if e.get("key") == "REFRAME_V2_ENABLED":
        api("DELETE", f"/envs/{e['uuid']}")
api("PATCH", "/envs/bulk", {"data": [{"key": "REFRAME_V2_ENABLED", "value": "1", "is_preview": False}]})
print("coolify_reframe_v2_web_ok")
PY
