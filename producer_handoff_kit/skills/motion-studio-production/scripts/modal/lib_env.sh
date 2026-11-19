# sourced by submit.sh / status.sh. Never prints secrets. Loads the job's credentials into the environment only.
#   job creds: <J>/secrets/{job_url,token}  (fallback: <J>/state/job_token + job id from <J>/job_id or the directory name)
KIT_MODAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
load_job_env() {
  local J="$1" url="" tok="" id=""
  if [ -f "$J/secrets/token" ] && [ -f "$J/secrets/job_url" ]; then
    tok="$(tr -d '[:space:]' < "$J/secrets/token")"; url="$(tr -d '[:space:]' < "$J/secrets/job_url")"; url="${url%/}"
    id="${url##*/jobs/}"; id="${id%%[/?]*}"
  elif [ -f "$J/state/job_token" ]; then
    tok="$(tr -d '[:space:]' < "$J/state/job_token")"
    if [ -f "$J/job_id" ]; then id="$(tr -d '[:space:]' < "$J/job_id")"; else id="$(basename "$J")"; fi
    url="https://transovo.ai/api/motion-studio/agent/jobs/$id"
  fi
  [ -n "$tok" ] && [ -n "$url" ] && [ -n "$id" ] || { echo "job credentials not found under $J/secrets (job_url, token)" >&2; return 2; }
  case "$url" in https://transovo.ai/api/motion-studio/agent/jobs/*) ;; *) echo "job URL must be https://transovo.ai/api/motion-studio/agent/jobs/<id>" >&2; return 2;; esac
  export MOTION_JOB_ID="$id" MOTION_JOB_URL="$url" MOTION_JOB_TOKEN="$tok"
}
load_modal_env() {
  local f="${MODAL_ENV_FILE:-/workspace/secrets/modal.env}"
  [ -f "$f" ] || { echo "Modal credentials file missing ($f); set MODAL_ENV_FILE" >&2; return 2; }
  set +x; set -a; . "$f"; set +a
  [ -n "${MODAL_TOKEN_ID:-}" ] && [ -n "${MODAL_TOKEN_SECRET:-}" ] || { echo "Modal credentials file must export MODAL_TOKEN_ID and MODAL_TOKEN_SECRET" >&2; return 2; }
}
