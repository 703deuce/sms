#!/usr/bin/env bash
# Build clips-worker image on coolify-server from a git tree (no git clone on host).
# Usage: ./scripts/deploy-worker.sh [git-ref] [ssh-host]
set -euo pipefail

REF="${1:-HEAD}"
HOST="${2:-coolify-server}"
REMOTE_SRC="/opt/clips-worker/src"
REMOTE_ENV="/opt/clips-worker/worker.env"
TARBALL="/tmp/worker-${REF//\//_}.tgz"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "[deploy-worker] archiving worker/ @ ${REF}"
git archive --format=tar.gz -o "$TARBALL" "${REF}" worker/

echo "[deploy-worker] scp → ${HOST}:/tmp/worker.tgz"
scp -q "$TARBALL" "${HOST}:/tmp/worker.tgz"

ssh "$HOST" "sudo bash -s" <<REMOTE
set -euo pipefail
REMOTE_SRC="${REMOTE_SRC}"
REMOTE_ENV="${REMOTE_ENV}"

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

echo "[deploy-worker] restart container"
docker rm -f clips-worker 2>/dev/null || true
docker run -d \\
  --name clips-worker \\
  --restart unless-stopped \\
  --network coolify \\
  --env-file "\${REMOTE_ENV}" \\
  clips-worker:latest

sleep 2
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
