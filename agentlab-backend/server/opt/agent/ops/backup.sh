#!/bin/bash
# Nightly Agent Lab backup: memory, skills, oh-home settings, build sources, run.sh.
# Does NOT include /opt/agent/.env, job outputs, conversations, or media.
# Keeps the last 14 archives under /opt/agent/backups.
set -euo pipefail
umask 077

DEST="${BACKUP_DIR:-/opt/agent/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="agent-lab-${STAMP}"
TMP="$(mktemp -d /tmp/agent-lab-backup.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

WORKDIR="$TMP/$NAME"
mkdir -p "$WORKDIR/workspace" "$WORKDIR/oh-home" "$WORKDIR/host"

copy_tree() {
  local src="$1" dst="$2"
  if [ -e "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
  fi
}

copy_tree /opt/agent/workspace/memory "$WORKDIR/workspace/memory"
copy_tree /opt/agent/workspace/skills "$WORKDIR/workspace/skills"

# oh-home settings only — skip provider-connections (may hold OAuth tokens),
# locks, and any large media that might appear later.
[ -f /opt/agent/oh-home/settings.json ] && cp -a /opt/agent/oh-home/settings.json "$WORKDIR/oh-home/"
[ -f /opt/agent/oh-home/hooks.json ] && cp -a /opt/agent/oh-home/hooks.json "$WORKDIR/oh-home/"
copy_tree /opt/agent/oh-home/profiles "$WORKDIR/oh-home/profiles"

copy_tree /opt/agent/build "$WORKDIR/host/build"
copy_tree /opt/agent/run.sh "$WORKDIR/host/run.sh"
# code: tools, runner, ops, AGENTS.md (no secrets, caches or backups)
for d in tools runner ops; do copy_tree /opt/agent/$d "$WORKDIR/host/agent-code/$d"; done
copy_tree /opt/agent/AGENTS.md "$WORKDIR/host/agent-code/AGENTS.md"
copy_tree /opt/agent/sync-settings.sh "$WORKDIR/host/agent-code/sync-settings.sh"
find "$WORKDIR/host/agent-code" \( -name __pycache__ -o -name '*.env' -o -name .env -o -name '*.pyc' -o -name 'bak-*' \) -prune -exec rm -rf {} + 2>/dev/null || true

# Manifest without secrets
{
  echo "stamp=${STAMP}"
  echo "host=$(hostname)"
  echo "created_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "contents=workspace/memory,workspace/skills,oh-home/{settings.json,hooks.json,profiles},host/build,host/run.sh,host/agent-code/{tools,runner,ops,AGENTS.md,sync-settings.sh}"
  echo "excluded=.env,provider-connections,conversations,jobs,project media,usage outputs"
} > "$WORKDIR/MANIFEST.txt"

mkdir -p "$DEST"
chmod 700 "$DEST"
ARCHIVE="$DEST/${NAME}.tar.gz"
tar -C "$TMP" -czf "$ARCHIVE" "$NAME"
chmod 600 "$ARCHIVE"

# Keep last 14
# shellcheck disable=SC2012
ls -1t "$DEST"/agent-lab-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

SIZE="$(du -h "$ARCHIVE" | awk '{print $1}')"
COUNT="$(ls -1 "$DEST"/agent-lab-*.tar.gz 2>/dev/null | wc -l | tr -d ' ')"
echo "backup: wrote $ARCHIVE ($SIZE); $COUNT archives retained (max 14)"

# Offsite copy to Backblaze B2 (S3 API) under agent-lab-backups/ in the bucket from /opt/agent/secrets/b2.env
# (root-only; never printed). Only objects under that prefix are ever written or pruned; keeps the newest 14.
if [ -r /opt/agent/secrets/b2.env ]; then
  if python3 /opt/agent/ops/b2s3.py put "$ARCHIVE" && python3 /opt/agent/ops/b2s3.py prune 14; then
    echo "backup: offsite copy uploaded to B2 (agent-lab-backups/$(basename "$ARCHIVE"))"
  else
    echo "backup: OFFSITE UPLOAD FAILED (local copy kept)" >&2
  fi
else
  echo "backup: no /opt/agent/secrets/b2.env; local copy only"
fi
