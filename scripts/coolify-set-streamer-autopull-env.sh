#!/usr/bin/env bash
# Enable Twitch rolling live auto-pull on Coolify web + clips worker env files.
# Run on coolify-server: bash scripts/coolify-set-streamer-autopull-env.sh
set -euo pipefail

APP_ID="${COOLIFY_APP_ID:-ds8s3hjin60qs6g7s0iqkixs}"
ENVFILE="${CLIPS_WORKER_ENV:-/opt/clips-worker/worker.env}"
TOKEN_FILE="${HOME}/.coolify-api-token"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "FATAL: missing $TOKEN_FILE" >&2
  exit 1
fi

python3 - "$APP_ID" "$ENVFILE" "$TOKEN_FILE" <<'PY'
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

app_id, envfile, token_path = sys.argv[1:4]
keys = {
    "STREAMER_AUTOPULL_ENABLED": "1",
    "STREAMER_TWITCH_ROLLING_ENABLED": "1",
    "STREAMER_ROLLING_CHUNK_MIN": "8",
}
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


envs = json.loads(api("GET", "/envs"))
for e in envs:
    if e.get("key") in keys:
        api("DELETE", f"/envs/{e['uuid']}")
api("PATCH", "/envs/bulk", {"data": [{"key": k, "value": v, "is_preview": False} for k, v in keys.items()]})
print("coolify_streamer_autopull_ok")

try:
    worker_text = subprocess.check_output(["sudo", "cat", envfile], text=True)
except (FileNotFoundError, subprocess.CalledProcessError):
    worker_text = Path(envfile).read_text() if os.path.exists(envfile) and os.access(envfile, os.R_OK) else ""
lines = worker_text.splitlines()
out: list[str] = []
for ln in lines:
    if "=" in ln and ln.split("=", 1)[0] in keys:
        continue
    out.append(ln)
for k, v in keys.items():
    out.append(f"{k}={v}")
worker_body = "\n".join(out) + "\n"
if os.access(envfile, os.W_OK):
    Path(envfile).write_text(worker_body)
    os.chmod(envfile, 0o600)
else:
    import tempfile

    with tempfile.NamedTemporaryFile("w", delete=False) as tmp:
        tmp.write(worker_body)
        tmp_path = tmp.name
    subprocess.check_call(["sudo", "cp", tmp_path, envfile])
    subprocess.check_call(["sudo", "chmod", "600", envfile])
    os.unlink(tmp_path)
print("worker_streamer_autopull_ok")
PY

echo "[coolify-set-streamer-autopull] set web env + worker.env — redeploy web app and run deploy-worker.sh"
