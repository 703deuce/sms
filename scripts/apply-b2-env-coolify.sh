#!/usr/bin/env bash
# Apply Backblaze B2 creds from a root-readable env file to Coolify web + clips worker.
# Usage on coolify-server: sudo -u cursor-agent ./scripts/apply-b2-env-coolify.sh /tmp/transovo-specs/b2.env
set -euo pipefail

B2_FILE="${1:?path to b2.env}"
APP_ID="${COOLIFY_APP_ID:-ds8s3hjin60qs6g7s0iqkixs}"
ENVFILE="${CLIPS_WORKER_ENV:-/opt/clips-worker/worker.env}"
TOKEN_FILE="${HOME}/.coolify-api-token"

if [[ ! -f "$B2_FILE" ]]; then
  echo "FATAL: missing $B2_FILE" >&2
  exit 1
fi
if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "FATAL: missing $TOKEN_FILE (run as cursor-agent)" >&2
  exit 1
fi

sudo cp -a "$ENVFILE" "${ENVFILE}.bak-$(date -u +%Y%m%dT%H%M%SZ)"

python3 - "$B2_FILE" "$APP_ID" "$ENVFILE" "$TOKEN_FILE" <<'PY'
import os, re, sys, json, urllib.request
from pathlib import Path

b2_path, app_id, envfile, token_path = sys.argv[1:5]
pairs: dict[str, str] = {}
for line in Path(b2_path).read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    m = re.match(r"([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
    if not m:
        raise SystemExit(f"invalid line in {b2_path}")
    pairs[m.group(1)] = m.group(2)

pairs["CLIPS_MAX_UPLOAD_BYTES"] = "5368709120"
keys = [
    "STORAGE_DRIVER",
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_FORCE_PATH_STYLE",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "CLIPS_MAX_UPLOAD_BYTES",
]
missing = [k for k in keys if k not in pairs]
if missing:
    raise SystemExit(f"missing keys: {missing}")

token = Path(token_path).read_text().strip()
bulk = {"data": [{"key": k, "value": pairs[k], "is_preview": False} for k in keys]}
req = urllib.request.Request(
    f"http://localhost:8000/api/v1/applications/{app_id}/envs/bulk",
    data=json.dumps(bulk).encode(),
    method="PATCH",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=120) as resp:
    resp.read()
print(f"coolify_bulk_ok keys={len(keys)}")

lines = Path(envfile).read_text().splitlines()
for k in keys:
    val = pairs[k]
    line = f"{k}={val}"
    found = False
    out = []
    for ln in lines:
        if ln.startswith(k + "="):
            out.append(line)
            found = True
        else:
            out.append(ln)
    if not found:
        out.append(line)
    lines = out
Path(envfile).write_text("\n".join(lines) + "\n")
os.chmod(envfile, 0o600)
print(f"worker_env_ok file={envfile}")
PY

echo "[apply-b2] shredding source file"
sudo shred -u "$B2_FILE"
echo "[apply-b2] done — restart Coolify app and redeploy workers"
