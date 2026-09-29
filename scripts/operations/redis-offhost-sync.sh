#!/usr/bin/env bash
# Copy Redis volume backups to an off-host destination when configured.
set -euo pipefail

SRC_DIR="${TRANSOVO_REDIS_BACKUP_DIR:-/data/backups/transovo-redis}"
DEST="${OFF_HOST_BACKUP_DESTINATION:-}"

if [[ -z "$DEST" ]]; then
  echo "[redis-offhost] OFF_HOST_BACKUP_DESTINATION not set — skipping (local backups remain at ${SRC_DIR})"
  exit 0
fi

LATEST="$(ls -1t "${SRC_DIR}"/redis-aof-snapshot-*.tar.gz 2>/dev/null | head -1)"
if [[ -z "$LATEST" ]]; then
  echo "[redis-offhost] ERROR: no redis backup tarball in ${SRC_DIR}" >&2
  exit 1
fi

if command -v rclone >/dev/null 2>&1; then
  rclone copy "$LATEST" "$DEST/transovo-redis/" --progress=false
elif [[ "$DEST" == s3://* ]] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "$LATEST" "${DEST%/}/$(basename "$LATEST")"
else
  echo "[redis-offhost] ERROR: unsupported OFF_HOST_BACKUP_DESTINATION (need rclone or aws cli)" >&2
  exit 2
fi

echo "[redis-offhost] synced $(basename "$LATEST")"
