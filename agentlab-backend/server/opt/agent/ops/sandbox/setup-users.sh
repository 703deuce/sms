#!/bin/bash
# Create the helper user, job group, and a pool of per-job UIDs on the host.
# Idempotent. Does not change /opt/agent/workspace permissions (that would
# break the live agent until run.sh is updated).
set -euo pipefail
GROUP=agentlab-jobs
GID=19998
HELPER=agentlab-helper
HELPER_UID=19999
POOL_START=20001
POOL_END=20100

if ! getent group "$GID" >/dev/null; then
  groupadd -g "$GID" "$GROUP"
  echo "created group $GROUP ($GID)"
else
  echo "group $GROUP already exists"
fi
if ! getent passwd "$HELPER_UID" >/dev/null; then
  useradd -u "$HELPER_UID" -g "$GID" -M -s /usr/sbin/nologin "$HELPER"
  echo "created user $HELPER ($HELPER_UID)"
else
  echo "user $HELPER already exists"
fi
# Keep the OpenHands daemon user in the jobs group so it can connect to the socket
# *before* track A switches command execution to per-job UIDs.
if getent passwd 10001 >/dev/null; then
  usermod -aG "$GROUP" "$(getent passwd 10001 | cut -d: -f1)" || true
fi
created=0
for uid in $(seq "$POOL_START" "$POOL_END"); do
  if getent passwd "$uid" >/dev/null; then
    continue
  fi
  useradd -u "$uid" -g "$GID" -M -s /usr/sbin/nologin "agentlab-job-$uid"
  created=$((created + 1))
done
echo "job user pool $POOL_START-$POOL_END; newly created: $created"
