#!/usr/bin/env bash
# Write ~/.ssh/cursor_coolify + coolify-server config from COOLIFY_SSH_KEY (never log key material).
set -euo pipefail
KEY="${COOLIFY_SSH_KEY:-}"
if [[ -z "$KEY" ]]; then
  echo "install-coolify-ssh: COOLIFY_SSH_KEY unset" >&2
  exit 1
fi
install -m 700 -d "${HOME}/.ssh"
install -m 600 /dev/null "${HOME}/.ssh/cursor_coolify"
printf '%s\n' "$KEY" > "${HOME}/.ssh/cursor_coolify"
{
  echo "Host coolify-server"
  echo "  HostName 128.140.102.51"
  echo "  User cursor-agent"
  echo "  IdentityFile ${HOME}/.ssh/cursor_coolify"
  echo "  StrictHostKeyChecking accept-new"
  echo "  BatchMode yes"
  echo "  ConnectTimeout 15"
} > "${HOME}/.ssh/config"
chmod 600 "${HOME}/.ssh/config"
ssh -o BatchMode=yes coolify-server true
echo "install-coolify-ssh: ok (IdentityFile ${HOME}/.ssh/cursor_coolify, user cursor-agent)"
