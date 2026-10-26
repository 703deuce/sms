#!/usr/bin/env bash
# Build clips-worker image on coolify-server from a git tree (no git clone on host).
# Usage: ./scripts/deploy-worker.sh [git-ref] [ssh-host]
set -euo pipefail

REF="${1:-HEAD}"
HOST="${2:-coolify-server}"
REMOTE_SRC="/opt/clips-worker/src"
REMOTE_ENV="/opt/clips-worker/worker.env"
TARBALL="/tmp/worker-${REF//\//_}.tgz"

REQUIRED_ENV_KEYS=(
  DATABASE_URL
  APP_URL
  WORKER_SHARED_SECRET
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  STORAGE_DRIVER
)

# Large stream uploads: set CLIPS_UPLOAD_STAGING_DIR on web + workers (shared volume).

# Streamer v1 is VOD-first. Live EventSub chat capture stays off unless worker.env sets:
# STREAMER_LIVE_REALTIME_ENABLED=true

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "[deploy-worker] archiving worker/ @ ${REF}"
git archive --format=tar.gz -o "$TARBALL" "${REF}" worker/

echo "[deploy-worker] scp → ${HOST}:/tmp/worker.tgz"
scp -q "$TARBALL" "${HOST}:/tmp/worker.tgz"
if [[ -f "${REPO_ROOT}/scripts/sync-deepgram-worker-env.py" ]]; then
  scp -q "${REPO_ROOT}/scripts/sync-deepgram-worker-env.py" "${HOST}:/tmp/sync-deepgram-worker-env.py"
fi

ssh "$HOST" "sudo bash -s" <<REMOTE
set -euo pipefail
REMOTE_SRC="${REMOTE_SRC}"
REMOTE_ENV="${REMOTE_ENV}"

disk_pct=\$(df / --output=pcent | tail -1 | tr -dc '0-9')
if [ -n "\${disk_pct}" ] && [ "\${disk_pct}" -gt 80 ]; then
  echo "[deploy-worker] disk at \${disk_pct}% — pruning docker builder cache and unused images (not volumes)"
  docker builder prune -af 2>/dev/null || true
  docker image prune -af 2>/dev/null || true
fi

if [ ! -f "\${REMOTE_ENV}" ]; then
  echo "[deploy-worker] FATAL: missing \${REMOTE_ENV}" >&2
  exit 1
fi

missing=0
for key in ${REQUIRED_ENV_KEYS[*]}; do
  if ! grep -q "^\${key}=" "\${REMOTE_ENV}"; then
    echo "[deploy-worker] FATAL: \${REMOTE_ENV} missing required key \${key}" >&2
    missing=1
  fi
done
if [ "\$missing" -ne 0 ]; then
  echo "[deploy-worker] Restore from /opt/clips-worker/worker.env.bak-* before recreating containers." >&2
  exit 1
fi

if [ -f /tmp/sync-deepgram-worker-env.py ]; then
  echo "[deploy-worker] sync DEEPGRAM_API_KEY from Coolify → \${REMOTE_ENV} (length-verified)"
  python3 /tmp/sync-deepgram-worker-env.py || echo "[deploy-worker] WARN: deepgram sync failed (continuing)" >&2
fi

if grep -q '^DEEPGRAM_API_KEY=' "\${REMOTE_ENV}" 2>/dev/null; then
  dg_len=\$(grep '^DEEPGRAM_API_KEY=' "\${REMOTE_ENV}" | tail -1 | cut -d= -f2- | tr -d '\\r\\n' | wc -c)
  echo "[deploy-worker] worker.env DEEPGRAM_API_KEY length=\${dg_len}"
  if [ "\${dg_len}" -lt 20 ]; then
    echo "[deploy-worker] FATAL: DEEPGRAM_API_KEY too short in \${REMOTE_ENV}" >&2
    exit 1
  fi
fi

echo "[deploy-worker] extract to \${REMOTE_SRC}"
rm -rf "\${REMOTE_SRC}"
mkdir -p "\${REMOTE_SRC}"
tar xzf /tmp/worker.tgz -C "\${REMOTE_SRC}"

echo "[deploy-worker] waiting for RUNNING RENDER_* / MUSIC jobs"
for i in \$(seq 1 120); do
  running=\$(docker exec clips-worker python3 -c "
import os, psycopg2
c = psycopg2.connect(os.environ['DATABASE_URL'])
r = c.cursor()
r.execute(\"\"\"
  SELECT count(*) FROM clip_jobs
  WHERE status = 'RUNNING'
    AND type IN ('IMPORT_URL', 'STREAM_IMPORT', 'RENDER_CLIP', 'RENDER_EXPORT', 'MUSIC', 'THUMBNAIL')
    AND "lockedAt" > NOW() - interval '3 minutes'
\"\"\")
print(r.fetchone()[0])
" 2>/dev/null || echo 0)
  if [ "\$running" = "0" ]; then
    echo "[deploy-worker] no blocking jobs"
    break
  fi
  echo "[deploy-worker] still running=\$running"
  sleep 10
done

echo "[deploy-worker] docker build"
cd "\${REMOTE_SRC}"
docker build -f worker/Dockerfile -t clips-worker:latest .

start_worker() {
  local name="\$1"
  local lane="\$2"
  local worker_id="\$3"
  echo "[deploy-worker] stopping \${name} (no overlap with new container)"
  docker stop "\$name" 2>/dev/null || true
  for _wait in \$(seq 1 45); do
    if ! docker ps -q -f name="^\${name}\$" | grep -q .; then
      break
    fi
    sleep 1
  done
  docker rm -f "\$name" 2>/dev/null || true
  docker run -d \\
    --name "\$name" \\
    --restart unless-stopped \\
    --network coolify \\
    --env-file "\${REMOTE_ENV}" \\
    -e "WORKER_LANE=\$lane" \\
    -e "WORKER_ID=\$worker_id" \\
    clips-worker:latest
}

echo "[deploy-worker] restart clips-worker (default lane)"
start_worker clips-worker default clips-worker-1
echo "[deploy-worker] restart clips-worker-stream (stream lane)"
start_worker clips-worker-stream stream clips-worker-stream-1

sleep 3
for name in clips-worker clips-worker-stream; do
  docker exec "\$name" python3 -c "import os; assert os.environ.get('DATABASE_URL'); print('\$name env_ok')"
  docker exec "\$name" python3 -c 'import os,sys; k=os.environ.get("DEEPGRAM_API_KEY") or ""; assert len(k)>=20, "DEEPGRAM_API_KEY missing in container (len=%s); use docker run --env-file after worker.env update" % len(k); print("deepgram_key_len=%s" % len(k))'
done

docker exec clips-worker python3 -c "
from clips_worker.job_types import JOB_TYPES
from clips_worker.main import DISPATCH
assert set(JOB_TYPES) == set(DISPATCH)
assert 'STREAM_IMPORT' in JOB_TYPES
print('claim_list_ok')
"

docker exec clips-worker python3 -m pytest -q \\
  /app/tests/test_job_types.py \\
  /app/tests/test_gpu_select.py \\
  /app/tests/test_normalize_words.py \\
  /app/tests/test_broll_ffmpeg.py \\
  /app/tests/test_audio_mix.py \\
  /app/tests/test_captions_ass_render.py \\
  /app/tests/test_frame_sampler.py

echo "[deploy-worker] prune old clips-worker images (keep latest + one previous tag)"
KEEP_TAG="clips-worker:keep-previous"
docker tag clips-worker:latest "\${KEEP_TAG}" 2>/dev/null || true
docker images clips-worker --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk '\$2!="latest" && \$2!="keep-previous" {print \$1}' | xargs -r docker rmi -f 2>/dev/null || true
docker images --format '{{.Repository}}:{{.Tag}}' | grep '^clips-worker:' | grep -v ':latest\$' | grep -v ':keep-previous\$' | xargs -r docker rmi -f 2>/dev/null || true

echo "[deploy-worker] done"
REMOTE

echo "[deploy-worker] complete (${REF} → clips-worker:latest on ${HOST})"
