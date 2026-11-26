#!/bin/bash
# Apply sandbox ownership to a workspace tree.
#   apply-perms.sh --root /path/to/workspace
# By default this REFUSES to touch the live /opt/agent/workspace so the
# running agent (uid 10001) is not locked out. Pass --live only after
# track A has wired job-exec / per-job users in run.sh.
set -euo pipefail
ROOT=""
LIVE=0
HELPER_UID=19999
JOB_GID=19998
while [ $# -gt 0 ]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    --live) LIVE=1; shift ;;
    *) echo "usage: apply-perms.sh --root DIR [--live]" >&2; exit 2 ;;
  esac
done
[ -n "$ROOT" ] || { echo "need --root" >&2; exit 2; }
ROOT="$(readlink -f "$ROOT")"
if [ "$ROOT" = "/opt/agent/workspace" ] && [ "$LIVE" != 1 ]; then
  echo "refusing to lock down the live workspace (would break the running agent)." >&2
  echo "re-run with --live after track A applies the run.sh changes." >&2
  exit 3
fi

# Tools, memory, skills, pages, usage: writable only by the helper user.
# World/agent can still *read*.
lock_tree() {
  local d="$1"
  [ -e "$d" ] || return 0
  chown -R "$HELPER_UID:$JOB_GID" "$d"
  find "$d" -type d -exec chmod 0755 {} +
  find "$d" -type f -exec chmod 0644 {} +
  # keep executables executable
  find "$d" -type f -perm -0111 -exec chmod 0755 {} +
}

mkdir -p "$ROOT/memory" "$ROOT/skills" "$ROOT/tools" "$ROOT/pages" "$ROOT/jobs" "$ROOT/.helper"
lock_tree "$ROOT/memory"
lock_tree "$ROOT/skills"
lock_tree "$ROOT/tools"
lock_tree "$ROOT/pages"
# usage logs should stay writable by whoever appends; leave usage alone unless present
# .helper holds the socket (daemon will chmod the socket itself)
chown "$HELPER_UID:$JOB_GID" "$ROOT/.helper"
chmod 0775 "$ROOT/.helper"

# Each existing job folder: allocate a uid and chown. Do not invent jobs.
MAP=/opt/agent/ops/sandbox
export AGENT_UID_MAP="${AGENT_UID_MAP:-$MAP/uid.map}"
if [ -d "$ROOT/jobs" ]; then
  for job in "$ROOT/jobs"/*; do
    [ -d "$job" ] || continue
    id="$(basename "$job")"
    case "$id" in *..*|*/*) continue ;; esac
    uid=$(python3 -c "import sys; sys.path.insert(0,'$MAP'); import uidmap; print(uidmap.allocate('$id'))")
    chown -R "$uid:$JOB_GID" "$job"
    # 0700/0600, not 0770: job users share gid 19998, so group-write on the
    # directory would let one job unlink another's files (directory write, not file owner, controls unlink).
    find "$job" -type d -exec chmod 0700 {} +
    find "$job" -type f -exec chmod 0600 {} +
    echo "job $id -> uid $uid"
  done
fi
# jobs/ directory itself: helper-owned, sticky so job users can create? No —
# new jobs are created by helperd init_job (root/10001). 10001 should not
# mkdir here after lockdown. 0755 helper-owned.
chown "$HELPER_UID:$JOB_GID" "$ROOT/jobs"
chmod 0755 "$ROOT/jobs"
echo "apply-perms: locked $ROOT (memory/skills/tools/pages + per-job uids)"
