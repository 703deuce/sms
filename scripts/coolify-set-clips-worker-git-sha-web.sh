#!/usr/bin/env bash
# Set CLIPS_WORKER_GIT_SHA on Coolify web app (runtime env for render cache invalidation).
# Run on coolify-server or via: ssh coolify-server "GIT_SHA=... bash -s" < scripts/coolify-set-clips-worker-git-sha-web.sh
set -euo pipefail

GIT_SHA="${GIT_SHA:-${1:-}}"
APP_ID="${COOLIFY_APP_ID:-ds8s3hjin60qs6g7s0iqkixs}"
TOKEN_FILE="${HOME}/.coolify-api-token"

if [[ -z "$GIT_SHA" ]]; then
  echo "Usage: GIT_SHA=<full-commit> $0" >&2
  exit 1
fi

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "FATAL: missing $TOKEN_FILE" >&2
  exit 1
fi

python3 - "$APP_ID" "$GIT_SHA" "$TOKEN_FILE" <<'PY'
import json
import sys
from pathlib import Path

app_id, git_sha, token_path = sys.argv[1:4]
key = "CLIPS_WORKER_GIT_SHA"
token = Path(token_path).read_text().strip()
base = f"http://localhost:8000/api/v1/applications/{app_id}"


def api(method: str, path: str, body: dict | None = None) -> bytes:
    import urllib.request

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
    if e.get("key") == key:
        api("DELETE", f"/envs/{e['uuid']}")
api("PATCH", "/envs/bulk", {"data": [{"key": key, "value": git_sha, "is_preview": False}]})
print(f"coolify_web_{key}={git_sha[:12]}")
PY

echo "[coolify-set-clips-worker-git-sha-web] restart web container to pick up runtime env (or queue web deploy)"
