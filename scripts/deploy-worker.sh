#!/usr/bin/env bash
# Build clips-worker image on coolify-server from a git tree (no git clone on host).
# Usage: ./scripts/deploy-worker.sh [git-ref] [ssh-host]
#
# Env knobs (all optional):
#   WORKER_ONLY=clips-worker|clips-worker-stream|both   (default: both)
#   WORKER_PREWAIT_MAX_SEC   pre-wait for RUNNING jobs on the rolled lane(s) (default: 0, opt-in)
#   WORKER_DRAIN_TIMEOUT_SEC SIGTERM drain per worker (default: 300)
set -euo pipefail

REF="${1:-HEAD}"
HOST="${2:-coolify-server}"
REMOTE_SRC="/opt/clips-worker/src"
REMOTE_ENV="/opt/clips-worker/worker.env"
TARBALL="/tmp/worker-${REF//\//_}.tgz"
WORKER_PREWAIT_MAX_SEC="${WORKER_PREWAIT_MAX_SEC:-0}"
WORKER_DRAIN_TIMEOUT_SEC="${WORKER_DRAIN_TIMEOUT_SEC:-300}"
WORKER_ONLY="${WORKER_ONLY:-both}"
WORKER_ROLLOUT_MAX_SEC="${WORKER_ROLLOUT_MAX_SEC:-2700}"  # local waiter gives up (rc 124, unit left running) after this

case "${WORKER_ONLY}" in
  clips-worker|clips-worker-stream|both) ;;
  *)
    echo "[deploy-worker] FATAL: WORKER_ONLY must be clips-worker, clips-worker-stream, or both (got: ${WORKER_ONLY})" >&2
    exit 1
    ;;
esac

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
bash "${REPO_ROOT}/scripts/check-overlay-geometry.sh"
cmp "${REPO_ROOT}/new-app/public/brand/twitch_white_128.png" "${REPO_ROOT}/worker/assets/brand/twitch_white_128.png"
cmp "${REPO_ROOT}/new-app/public/brand/kick_black_128.png" "${REPO_ROOT}/worker/assets/brand/kick_black_128.png"
cmp "${REPO_ROOT}/new-app/tests/fixtures/loop_trim_cases.json" "${REPO_ROOT}/worker/tests/fixtures/loop_trim_cases.json"
cmp "${REPO_ROOT}/new-app/tests/fixtures/reorder_cases.json" "${REPO_ROOT}/worker/tests/fixtures/reorder_cases.json"
GIT_COMMIT="$(git rev-parse "${REF}^{commit}" 2>/dev/null || echo "${REF}")"

echo "[deploy-worker] archiving worker/ @ ${REF} (${GIT_COMMIT})"
git archive --format=tar.gz -o "$TARBALL" "${REF}" worker/

echo "[deploy-worker] scp → ${HOST}:/tmp/worker.tgz"
scp -q "$TARBALL" "${HOST}:/tmp/worker.tgz"
if [[ -f "${REPO_ROOT}/scripts/sync-deepgram-worker-env.py" ]]; then
  scp -q "${REPO_ROOT}/scripts/sync-deepgram-worker-env.py" "${HOST}:/tmp/sync-deepgram-worker-env.py"
fi

SAFE_SHA="$(printf '%s' "${GIT_COMMIT}" | tr -c 'a-zA-Z0-9._-' '-' )"
SHORT_SHA="$(printf '%s' "${SAFE_SHA}" | cut -c1-12)"
REMOTE_SCRIPT="/tmp/deploy-worker-remote-${SAFE_SHA}.sh"
REMOTE_LOG="/tmp/deploy-worker-remote-${SAFE_SHA}.log"
REMOTE_RC="/tmp/deploy-worker-remote-${SAFE_SHA}.rc"
UNIT="clips-worker-deploy-${SHORT_SHA}"

LOCAL_REMOTE="$(mktemp /tmp/deploy-worker-remote.XXXXXX)"
{
  cat <<PREAMBLE
#!/usr/bin/env bash
set -euo pipefail
REMOTE_SRC=$(printf '%q' "${REMOTE_SRC}")
REMOTE_ENV=$(printf '%q' "${REMOTE_ENV}")
GIT_COMMIT=$(printf '%q' "${GIT_COMMIT}")
WORKER_PREWAIT_MAX_SEC=$(printf '%q' "${WORKER_PREWAIT_MAX_SEC}")
WORKER_DRAIN_TIMEOUT_SEC=$(printf '%q' "${WORKER_DRAIN_TIMEOUT_SEC}")
WORKER_ONLY=$(printf '%q' "${WORKER_ONLY}")
REQUIRED_ENV_KEYS=( ${REQUIRED_ENV_KEYS[*]} )
trap 'echo \$? > $(printf '%q' "${REMOTE_RC}")' EXIT
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM
PREAMBLE
  cat <<'REMOTE'
disk_pct=$(df / --output=pcent | tail -1 | tr -dc '0-9')
if [ -n "${disk_pct}" ] && [ "${disk_pct}" -gt 80 ]; then
  echo "[deploy-worker] disk at ${disk_pct}% — pruning docker builder cache and unused images (not volumes)"
  docker builder prune -af 2>/dev/null || true
  docker image prune -af 2>/dev/null || true
fi

if [ ! -f "${REMOTE_ENV}" ]; then
  echo "[deploy-worker] FATAL: missing ${REMOTE_ENV}" >&2
  exit 1
fi

missing=0
for key in "${REQUIRED_ENV_KEYS[@]}"; do
  if ! grep -q "^${key}=" "${REMOTE_ENV}"; then
    echo "[deploy-worker] FATAL: ${REMOTE_ENV} missing required key ${key}" >&2
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  echo "[deploy-worker] Restore from /opt/clips-worker/worker.env.bak-* before recreating containers." >&2
  exit 1
fi

if [ -f /tmp/sync-deepgram-worker-env.py ]; then
  echo "[deploy-worker] sync DEEPGRAM_API_KEY from Coolify → ${REMOTE_ENV} (length-verified)"
  python3 /tmp/sync-deepgram-worker-env.py || echo "[deploy-worker] WARN: deepgram sync failed (continuing)" >&2
fi

if grep -q '^DEEPGRAM_API_KEY=' "${REMOTE_ENV}" 2>/dev/null; then
  dg_len=$(grep '^DEEPGRAM_API_KEY=' "${REMOTE_ENV}" | tail -1 | cut -d= -f2- | tr -d '\r\n' | wc -c)
  echo "[deploy-worker] worker.env DEEPGRAM_API_KEY length=${dg_len}"
  if [ "${dg_len}" -lt 20 ]; then
    echo "[deploy-worker] FATAL: DEEPGRAM_API_KEY too short in ${REMOTE_ENV}" >&2
    exit 1
  fi
fi

echo "[deploy-worker] extract to ${REMOTE_SRC}"
rm -rf "${REMOTE_SRC}"
mkdir -p "${REMOTE_SRC}"
tar xzf /tmp/worker.tgz -C "${REMOTE_SRC}"

DRAIN_TIMEOUT="${WORKER_DRAIN_TIMEOUT_SEC}"
# Stream lane types match worker/clips_worker/streamer/lanes.py; default lane is everything else.
STREAM_SQL="'STREAM_IMPORT', 'STREAM_RENDER', 'STREAM_RELAYOUT', 'STREAM_CLEANUP', 'STREAM_MONTAGE', 'STREAM_AUTOPULL'"
case "${WORKER_ONLY}" in
  clips-worker)
    TYPE_FILTER="AND type NOT IN (${STREAM_SQL})"
    ;;
  clips-worker-stream)
    TYPE_FILTER="AND type IN (${STREAM_SQL})"
    ;;
  both)
    TYPE_FILTER=""
    ;;
  *)
    echo "[deploy-worker] FATAL: WORKER_ONLY must be clips-worker, clips-worker-stream, or both (got: ${WORKER_ONLY})" >&2
    exit 1
    ;;
esac

if [ "${WORKER_PREWAIT_MAX_SEC}" -gt 0 ]; then
  echo "[deploy-worker] pre-wait up to ${WORKER_PREWAIT_MAX_SEC}s for RUNNING jobs on ${WORKER_ONLY}"
  probe="clips-worker"
  if ! docker ps -q -f name='^clips-worker$' | grep -q .; then
    probe="clips-worker-stream"
  fi
  elapsed=0
  while [ "${elapsed}" -lt "${WORKER_PREWAIT_MAX_SEC}" ]; do
    running=$(docker exec "${probe}" python3 -c "
import os, psycopg2
c = psycopg2.connect(os.environ['DATABASE_URL'])
r = c.cursor()
r.execute(\"\"\"
  SELECT count(*) FROM clip_jobs
  WHERE status = 'RUNNING'
    AND \"lockedAt\" > NOW() - interval '15 minutes'
    ${TYPE_FILTER}
\"\"\")
print(r.fetchone()[0])
" 2>/dev/null || echo 0)
    if [ "$running" = "0" ]; then
      echo "[deploy-worker] no blocking jobs"
      break
    fi
    echo "[deploy-worker] still running=$running (pre-wait ${elapsed}s/${WORKER_PREWAIT_MAX_SEC}s; drain timeout=${DRAIN_TIMEOUT}s)"
    sleep 10
    elapsed=$((elapsed + 10))
  done
else
  echo "[deploy-worker] pre-wait disabled (WORKER_PREWAIT_MAX_SEC=0); check for long RUNNING jobs before rolling"
fi

echo "[deploy-worker] docker build"
cd "${REMOTE_SRC}"

echo "[deploy-worker] deploy gate (compile + import + dry poll)"
docker build -f worker/Dockerfile --build-arg GIT_COMMIT="${GIT_COMMIT}" -t clips-worker:gate .
docker run --rm --env-file "${REMOTE_ENV}" --network coolify clips-worker:gate python3 -m compileall -q /app/clips_worker
docker run --rm --env-file "${REMOTE_ENV}" --network coolify clips-worker:gate python3 -c 'import clips_worker.main'
docker run --rm --env-file "${REMOTE_ENV}" --network coolify clips-worker:gate python3 scripts/run_worker_lint.py
docker run --rm --env-file "${REMOTE_ENV}" --network coolify clips-worker:gate python3 scripts/deploy_smoke.py
docker run --rm --env-file "${REMOTE_ENV}" --network coolify clips-worker:gate python3 -c '
import os, psycopg2
from clips_worker.job_contract import dry_poll_iteration
conn = psycopg2.connect(os.environ["DATABASE_URL"])
try:
    dry_poll_iteration(conn)
finally:
    conn.close()
print("deploy_gate_ok")
'
docker tag clips-worker:gate clips-worker:latest

# Stable public URL — Coolify renames web containers on every deploy; container-name callbacks go stale.
WORKER_CALLBACK_URL="${WORKER_CALLBACK_URL:-https://transovo.ai}"
echo "[deploy-worker] WORKER_CALLBACK_URL=${WORKER_CALLBACK_URL} (progress callbacks; post_progress retries 502 during deploy)"

start_worker() {
  local name="$1"
  local lane="$2"
  local worker_id="$3"
  echo "[deploy-worker] stopping ${name} (SIGTERM drain, up to ${DRAIN_TIMEOUT}s)"
  docker stop -t "${DRAIN_TIMEOUT}" "$name" 2>/dev/null || true
  for _wait in $(seq 1 "${DRAIN_TIMEOUT}"); do
    if ! docker ps -q -f name="^${name}\$" | grep -q .; then
      break
    fi
    sleep 1
  done
  docker rm -f "$name" 2>/dev/null || true
  mkdir -p /opt/clips-worker/cache
  docker run -d \
    --name "$name" \
    --restart unless-stopped \
    --network coolify \
    --env-file "${REMOTE_ENV}" \
    -v /opt/clips-worker/cache:/opt/clips-worker/cache \
    -e "WORKER_LANE=$lane" \
    -e "WORKER_ID=$worker_id" \
    ${WORKER_CALLBACK_URL:+-e "WORKER_CALLBACK_URL=$WORKER_CALLBACK_URL"} \
    clips-worker:latest
}

case "${WORKER_ONLY}" in
  clips-worker)
    echo "[deploy-worker] restart clips-worker (default lane)"
    start_worker clips-worker default clips-worker-1
    CHECK_WORKERS="clips-worker"
    ;;
  clips-worker-stream)
    echo "[deploy-worker] restart clips-worker-stream (stream lane)"
    start_worker clips-worker-stream stream clips-worker-stream-1
    CHECK_WORKERS="clips-worker-stream"
    ;;
  both)
    echo "[deploy-worker] restart clips-worker (default lane)"
    start_worker clips-worker default clips-worker-1
    echo "[deploy-worker] restart clips-worker-stream (stream lane)"
    start_worker clips-worker-stream stream clips-worker-stream-1
    CHECK_WORKERS="clips-worker clips-worker-stream"
    ;;
esac

sleep 3
for name in ${CHECK_WORKERS}; do
  docker exec "$name" python3 -c "import os; assert os.environ.get('DATABASE_URL'); print('$name env_ok')"
  docker exec "$name" python3 -c 'import os,sys; k=os.environ.get("DEEPGRAM_API_KEY") or ""; assert len(k)>=20, "DEEPGRAM_API_KEY missing in container (len=%s); use docker run --env-file after worker.env update" % len(k); print("deepgram_key_len=%s" % len(k))'
done

PRIMARY="${CHECK_WORKERS%% *}"
docker exec "${PRIMARY}" python3 -c "
from clips_worker.job_types import JOB_TYPES
from clips_worker.main import DISPATCH
assert set(JOB_TYPES) == set(DISPATCH)
assert 'STREAM_IMPORT' in JOB_TYPES
print('claim_list_ok')
"

docker exec "${PRIMARY}" python3 -m pytest -q \
  /app/tests/test_job_types.py \
  /app/tests/test_gpu_select.py \
  /app/tests/test_normalize_words.py \
  /app/tests/test_broll_ffmpeg.py \
  /app/tests/test_audio_mix.py \
  /app/tests/test_captions_ass_render.py \
  /app/tests/test_frame_sampler.py \
  /app/tests/test_layers_spec.py \
  /app/tests/test_composite_export_edits.py \
  /app/tests/test_layer_sprites.py \
  /app/tests/test_render_stack_pip.py

echo "[deploy-worker] prune old clips-worker images (keep latest tag for docker run)"
KEEP_ID=$(docker images clips-worker:latest --format '{{.ID}}' | head -1)
if [ -n "${KEEP_ID}" ]; then
  # Remove clips-worker tags other than latest (e.g. :gate). Do not rmi :latest.
  docker images clips-worker --format '{{.Repository}} {{.Tag}} {{.ID}}' | awk -v keep="${KEEP_ID}" '
    $1 == "clips-worker" && $2 != "latest" && $2 != "<none>" { print $1 ":" $2 }
  ' | xargs -r docker rmi 2>/dev/null || true
  # Remove remaining image IDs that are not latest's ID.
  docker images clips-worker --format '{{.ID}}' | awk -v keep="${KEEP_ID}" '$1 != keep { print $1 }' | sort -u | xargs -r docker rmi -f 2>/dev/null || true
fi

echo "[deploy-worker] done"
REMOTE
} > "${LOCAL_REMOTE}"

echo "[deploy-worker] scp remote rollout script → ${HOST}:${REMOTE_SCRIPT}"
scp -q "${LOCAL_REMOTE}" "${HOST}:/tmp/deploy-worker-remote-${SAFE_SHA}.sh.in"
rm -f "${LOCAL_REMOTE}"

echo "[deploy-worker] starting remote unit ${UNIT} (log ${REMOTE_LOG})"
ssh "$HOST" "sudo bash -c '
  set -euo pipefail
  st=\$(systemctl is-active ${UNIT} 2>/dev/null || true)
  if { [ \"\$st\" = active ] || [ \"\$st\" = activating ] || [ \"\$st\" = reloading ]; } && [ ! -f ${REMOTE_RC} ]; then
    echo \"[deploy-worker] ${UNIT} is still running (\$st); refusing to stop an in-flight rollout. Watch ${REMOTE_LOG} or stop it manually.\" >&2
    exit 3
  fi
  systemctl stop ${UNIT} 2>/dev/null || true
  mv -f /tmp/deploy-worker-remote-${SAFE_SHA}.sh.in ${REMOTE_SCRIPT}
  chmod 755 ${REMOTE_SCRIPT}
  rm -f ${REMOTE_LOG} ${REMOTE_RC}
  touch ${REMOTE_LOG}
  chmod 644 ${REMOTE_LOG}
  systemctl reset-failed ${UNIT} 2>/dev/null || true
  systemd-run --no-block --unit=${UNIT} --collect --remain-after-exit -p Type=oneshot -p StandardOutput=append:${REMOTE_LOG} -p StandardError=append:${REMOTE_LOG} -- /bin/bash ${REMOTE_SCRIPT}
'"

wait_for_remote_unit() {
  local host="$1" unit="$2" log="$3"
  local pos=0 state="" status="" tmp chunk_bytes ssh_fail=0 dead_seen=0
  local max_sec="${WORKER_ROLLOUT_MAX_SEC}" start_ts=$SECONDS
  tmp="$(mktemp)"
  echo "[deploy-worker] polling ${unit}; tailing ${log}"
  while true; do
    if ssh "$host" "sudo tail -c +$((pos + 1)) -- $(printf '%q' "$log")" >"$tmp" 2>/dev/null; then
      ssh_fail=0
      chunk_bytes=$(wc -c <"$tmp" | tr -d ' ')
      if [ "${chunk_bytes}" -gt 0 ]; then
        cat "$tmp"
        pos=$((pos + chunk_bytes))
      fi
    else
      ssh_fail=$((ssh_fail + 1))
      if [ "$ssh_fail" -eq 1 ] || [ $((ssh_fail % 10)) -eq 0 ]; then
        echo "[deploy-worker] ssh dropped while polling (attempt ${ssh_fail}); remote unit still running, retrying"
      fi
    fi
    # Completion = the remote script's EXIT trap wrote its rc file (robust to --collect unloading the unit).
    if status=$(ssh "$host" "sudo cat -- $(printf '%q' "$REMOTE_RC") 2>/dev/null"); then
      if ssh "$host" "sudo tail -c +$((pos + 1)) -- $(printf '%q' "$log")" >"$tmp" 2>/dev/null; then
        cat "$tmp"
      fi
      break
    fi
    # An unknown/unloaded unit reports SubState=dead; an SSH drop must not look like that.
    if ! state=$(ssh "$host" "sudo systemctl show -p SubState --value $(printf '%q' "$unit") 2>/dev/null"); then
      state="ssh-fail"
    fi
    if [ "$state" = failed ]; then
      status=1
      break
    fi
    # SIGKILL / reboot / --collect unload: unit gone or dead with no rc file. Require two
    # consecutive sightings so the brief pre-start window after --no-block isn't misread.
    if [ "$state" = dead ]; then
      dead_seen=$((dead_seen + 1))
      if [ "$dead_seen" -ge 2 ]; then
        echo "[deploy-worker] ${unit} is dead/unloaded with no rc file; treating as failed" >&2
        status=1
        break
      fi
    else
      dead_seen=0
    fi
    if [ $((SECONDS - start_ts)) -ge "$max_sec" ]; then
      echo "[deploy-worker] ${unit} still not finished after ${max_sec}s (WORKER_ROLLOUT_MAX_SEC); giving up locally. Check ${log} on the server." >&2
      rm -f "$tmp"
      return 124
    fi
    sleep 3
  done
  rm -f "$tmp"
  status="$(printf '%s' "${status}" | tr -dc '0-9')"
  ssh "$host" "sudo systemctl stop $(printf '%q' "$unit") 2>/dev/null || true; sudo systemctl reset-failed $(printf '%q' "$unit") 2>/dev/null || true" || true
  if ! [[ "${status}" =~ ^[0-9]+$ ]]; then
    status=1
  fi
  if [ "${status}" -ne 0 ]; then
    echo "[deploy-worker] remote unit ${unit} failed (status=${status})" >&2
    return "${status}"
  fi
  return 0
}

wait_for_remote_unit "$HOST" "$UNIT" "$REMOTE_LOG"

echo "[deploy-worker] sync CLIPS_WORKER_GIT_SHA → Coolify web env (render cache invalidation)"
ssh "$HOST" "GIT_SHA=${GIT_COMMIT} bash -s" < "${REPO_ROOT}/scripts/coolify-set-clips-worker-git-sha-web.sh" || \
  echo "[deploy-worker] WARN: could not sync CLIPS_WORKER_GIT_SHA to web (set manually + restart web)" >&2

echo "[deploy-worker] complete (${REF} → clips-worker:latest on ${HOST}; WORKER_ONLY=${WORKER_ONLY})"
