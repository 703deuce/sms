#!/usr/bin/env bash
# Enable all T6 feature flags on Coolify web (NEXT_PUBLIC_*) + clips worker env.
# Run on coolify-server: bash coolify-set-t6-env.sh
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
from pathlib import Path

app_id, envfile, token_path = sys.argv[1:4]
web_keys = {
    "NEXT_PUBLIC_T6_SIGNALS": "1",
    "NEXT_PUBLIC_T6_TEMPLATES": "1",
    "NEXT_PUBLIC_T6_CAPTION_PRESETS": "1",
    "NEXT_PUBLIC_T6_TITLE_AUTO": "1",
}
worker_keys = {
    "T6_SIGNALS": "1",
    "T6_TEMPLATES": "1",
    "T6_CAPTION_PRESETS": "1",
    "T6_TITLE_AUTO": "1",
}
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
    if e.get("key") in web_keys:
        api("DELETE", f"/envs/{e['uuid']}")
api(
    "PATCH",
    "/envs/bulk",
    {"data": [{"key": k, "value": v, "is_preview": False} for k, v in web_keys.items()]},
)
print("coolify_t6_web_env_ok")

try:
    worker_text = subprocess.check_output(["sudo", "cat", envfile], text=True)
except (FileNotFoundError, subprocess.CalledProcessError):
    worker_text = Path(envfile).read_text() if os.path.exists(envfile) and os.access(envfile, os.R_OK) else ""

all_worker = worker_keys
lines = worker_text.splitlines()
out: list[str] = []
for ln in lines:
    if "=" in ln and ln.split("=", 1)[0] in all_worker:
        continue
    out.append(ln)
for k, v in all_worker.items():
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
print("worker_t6_env_ok")
PY

echo "[coolify-set-t6-env] T6 flags set — redeploy web (NEXT_PUBLIC bake) and deploy-worker.sh"
