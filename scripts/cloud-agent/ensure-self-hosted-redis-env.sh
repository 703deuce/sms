#!/usr/bin/env bash
# Cloud Agent: reach Coolify self-hosted BullMQ Redis via SSH tunnel (Upstash not used).
set -euo pipefail

LOCAL_PORT="${BULLMQ_REDIS_LOCAL_PORT:-63790}"
COOLIFY_HOST="${COOLIFY_SSH_HOST:-coolify-server}"
TUNNEL_PID_FILE="${TMPDIR:-/tmp}/transovo-bullmq-redis-tunnel.pid"
WORKSPACE_ENV="${WORKSPACE_ENV:-/workspace/.env}"

if ! command -v ssh >/dev/null 2>&1; then
  echo "ensure-self-hosted-redis-env: ssh not available" >&2
  exit 1
fi

# Remote loopback must match infra/coolify/transovo-bullmq-redis/docker-compose.yml
REMOTE_BIND="127.0.0.1:${LOCAL_PORT}"

tunnel_running() {
  if [[ -f "$TUNNEL_PID_FILE" ]]; then
    local pid
    pid="$(cat "$TUNNEL_PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

if ! tunnel_running; then
  ssh -f -N \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o StrictHostKeyChecking=accept-new \
    -L "127.0.0.1:${LOCAL_PORT}:${REMOTE_BIND}" \
    "$COOLIFY_HOST"
  sleep 1
  pgrep -f "ssh.*${LOCAL_PORT}:${REMOTE_BIND}" | head -1 >"$TUNNEL_PID_FILE" || true
fi

# Build REDIS_URL from production app env (password never printed).
REDIS_LINE="$(ssh "$COOLIFY_HOST" "grep -E '^REDIS_URL=' /data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env | head -1")"
if [[ -z "$REDIS_LINE" ]]; then
  echo "ensure-self-hosted-redis-env: REDIS_URL missing on Coolify app .env" >&2
  exit 1
fi

# Replace docker hostname with local tunnel endpoint.
export REDIS_LINE
export LOCAL_PORT
SELF_REDIS_URL="$(python3 - <<'PY'
import os, urllib.parse
line = os.environ["REDIS_LINE"]
val = line.split("=", 1)[1].strip().strip('"').strip("'")
u = urllib.parse.urlparse(val)
port = int(os.environ["LOCAL_PORT"])
user = u.username or ""
password = u.password or ""
host = "127.0.0.1"
auth = ""
if password:
    auth = f"{user}:{password}@" if user else f":{password}@"
elif user:
    auth = f"{user}@"
print(f"redis://{auth}{host}:{port}{u.path or ''}")
PY
)"

export REDIS_URL="$SELF_REDIS_URL"
export QUEUE_DRIVER="${QUEUE_DRIVER:-bullmq}"

mkdir -p "$(dirname "$WORKSPACE_ENV")"
# Merge into gitignored .env (quoted values; consumed by preload-self-hosted-redis.mjs).
export SELF_REDIS_URL QUEUE_DRIVER WORKSPACE_ENV
python3 - <<'PY'
import os, re
path = os.environ["WORKSPACE_ENV"]
redis_url = os.environ["SELF_REDIS_URL"]
queue_driver = os.environ.get("QUEUE_DRIVER", "bullmq")
lines = []
if os.path.isfile(path):
    for line in open(path, encoding="utf-8"):
        if re.match(r"^REDIS_URL=", line) or re.match(r"^QUEUE_DRIVER=", line):
            continue
        lines.append(line.rstrip("\n"))
lines.append(f'REDIS_URL="{redis_url}"')
lines.append(f"QUEUE_DRIVER={queue_driver}")
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
PY

# Prove tunnel + Redis respond before agents rely on this file.
if ! python3 - <<'PY'
import os, socket, sys, urllib.parse
port = int(os.environ.get("LOCAL_PORT", "63790"))
s = socket.socket()
s.settimeout(3)
try:
    s.connect(("127.0.0.1", port))
except OSError:
    sys.exit(1)
finally:
    s.close()
sys.exit(0)
PY
then
  echo "ensure-self-hosted-redis-env: tunnel port ${LOCAL_PORT} not reachable" >&2
  exit 1
fi

# Redacted confirmation only
python3 - <<'PY'
import os, urllib.parse
u = urllib.parse.urlparse(os.environ["REDIS_URL"])
print(f"ensure-self-hosted-redis-env: REDIS_URL=redis://***@{u.hostname}:{u.port} QUEUE_DRIVER={os.environ.get('QUEUE_DRIVER')}")
PY
