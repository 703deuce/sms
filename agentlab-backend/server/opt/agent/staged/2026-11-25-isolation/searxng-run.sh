#!/bin/bash
# Recreates the searxng container exactly as it ran before 2026-11-25 (same image ID, port, config bind and
# cache volume), plus bounded docker logs. Usage: searxng-run.sh <image-id> <cache-volume-name>
set -e
IMG="$1"; VOL="$2"
[ -n "$IMG" ] && [ -n "$VOL" ] || { echo "usage: $0 IMAGE_ID VOLUME_NAME"; exit 1; }
docker rm -f searxng >/dev/null 2>&1 || true
docker run -d --name searxng --restart unless-stopped \
  -p 127.0.0.1:8888:8080 \
  -v /opt/agent/searxng:/etc/searxng \
  -v "$VOL":/var/cache/searxng \
  --log-opt max-size=10m --log-opt max-file=3 \
  "$IMG"
