#!/usr/bin/env bash
# Apply Backblaze B2 creds from env file to Coolify web + clips worker (length-verified).
# Usage on coolify-server:
#   ./scripts/apply-b2-env-coolify.sh /tmp/transovo-specs/b2.env
# Reads the file via sudo when not readable by cursor-agent. Does not shred until verified.
set -euo pipefail

B2_FILE="${1:?path to b2.env}"
APP_ID="${COOLIFY_APP_ID:-ds8s3hjin60qs6g7s0iqkixs}"
ENVFILE="${CLIPS_WORKER_ENV:-/opt/clips-worker/worker.env}"
TOKEN_FILE="${HOME}/.coolify-api-token"
SHRED_AFTER="${SHRED_AFTER:-1}"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "FATAL: missing $TOKEN_FILE (run as cursor-agent)" >&2
  exit 1
fi
if ! sudo test -f "$B2_FILE"; then
  echo "FATAL: missing $B2_FILE" >&2
  exit 1
fi

sudo cp -a "$ENVFILE" "${ENVFILE}.bak-$(date -u +%Y%m%dT%H%M%SZ)"

python3 - "$B2_FILE" "$APP_ID" "$ENVFILE" "$TOKEN_FILE" "$SHRED_AFTER" <<'PY'
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

b2_path, app_id, envfile, token_path, shred_after = sys.argv[1:6]
shred = shred_after.strip() not in ("0", "false", "no")

def read_b2_file(path: str) -> dict[str, str]:
    if os.access(path, os.R_OK):
        raw = Path(path).read_text()
    else:
        raw = subprocess.check_output(["sudo", "cat", path], text=True)
    pairs: dict[str, str] = {}
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if not m:
            raise SystemExit(f"invalid line in {path}")
        pairs[m.group(1)] = m.group(2)
    return pairs

pairs = read_b2_file(b2_path)
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
    raise SystemExit(f"missing keys in file: {missing}")

expected_len = {k: len(pairs[k]) for k in keys}
token = Path(token_path).read_text().strip()
base = f"http://localhost:8000/api/v1/applications/{app_id}"

def api(method: str, path: str, body: dict | None = None) -> bytes:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{base}{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()

# Delete every existing row for keys we set (no duplicates).
envs = json.loads(api("GET", "/envs"))
deleted = 0
for e in envs:
    if e.get("key") in keys:
        api("DELETE", f"/envs/{e['uuid']}")
        deleted += 1
print(f"coolify_deleted_rows={deleted}")

bulk = {"data": [{"key": k, "value": pairs[k], "is_preview": False} for k in keys]}
api("PATCH", "/envs/bulk", bulk)
print(f"coolify_bulk_ok keys={len(keys)}")

# worker.env — single line per key
worker_text = Path(envfile).read_text() if Path(envfile).exists() else ""
lines = worker_text.splitlines()
out: list[str] = []
seen: set[str] = set()
for ln in lines:
    if "=" in ln:
        k = ln.split("=", 1)[0]
        if k in keys:
            continue
    out.append(ln)
for k in keys:
    out.append(f"{k}={pairs[k]}")
Path(envfile).write_text("\n".join(out) + "\n")
os.chmod(envfile, 0o600)
print("worker_env_written")

# Verify Coolify real_value lengths
envs_after = json.loads(api("GET", "/envs"))
coolify_by_key: dict[str, str] = {}
for e in envs_after:
    k = e.get("key")
    if k in keys:
        coolify_by_key[k] = e.get("real_value") or e.get("value") or ""

errors: list[str] = []
for k in keys:
    if k not in coolify_by_key:
        errors.append(f"coolify missing key {k}")
        continue
    if len(coolify_by_key[k]) != expected_len[k]:
        errors.append(f"coolify {k} len {len(coolify_by_key[k])} != expected {expected_len[k]}")

worker_vals: dict[str, str] = {}
for ln in Path(envfile).read_text().splitlines():
    if "=" not in ln:
        continue
    k, v = ln.split("=", 1)
    if k in keys:
        worker_vals[k] = v
for k in keys:
    if k not in worker_vals:
        errors.append(f"worker missing key {k}")
    elif len(worker_vals[k]) != expected_len[k]:
        errors.append(f"worker {k} len {len(worker_vals[k])} != expected {expected_len[k]}")

if errors:
    print("VERIFY_FAILED")
    for err in errors:
        print(err)
    sys.exit(1)

print("VERIFY_OK lengths_match=true")
for k in keys:
    print(f"  {k} len={expected_len[k]}")

if shred:
    subprocess.check_call(["sudo", "shred", "-u", b2_path])
    print("b2_env_shredded=ok")
else:
    print("b2_env_shredded=skipped")
PY

echo "[apply-b2] done — restart Coolify app and redeploy workers"
