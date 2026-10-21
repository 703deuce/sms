#!/usr/bin/env bash
# Configure SSH for Coolify/Hetzner (Cloud Agent + CI).
# Accepts multiple secret names; never prints key material.
set -euo pipefail

HOST="${TRANSOVO_SSH_HOST:-${COOLIFY_SSH_HOST:-128.140.102.51}}"
USER="${TRANSOVO_SSH_USER:-${COOLIFY_SSH_USER:-cursor-agent}}"
KEY_FILE="${TRANSOVO_SSH_KEY_PATH:-${COOLIFY_SSH_KEY_PATH:-$HOME/.ssh/cursor_coolify}}"
SSH_CONFIG="${HOME}/.ssh/config"
MARKER="# transovo-coolify-ssh (managed)"

reflow_pem() {
  python3 - <<'PY'
import os, re, sys
raw = sys.stdin.read().strip()
if not raw or "\n" in raw:
    print(raw)
    sys.exit(0)
m_begin = re.search(r"-----BEGIN [^-]+-----", raw)
m_end = re.search(r"-----END [^-]+-----", raw)
if not m_begin or not m_end:
    print(raw)
    sys.exit(0)
body = raw[m_begin.end() : m_end.start()].replace(" ", "").replace("\t", "")
lines = [m_begin.group(0)]
for i in range(0, len(body), 64):
    lines.append(body[i : i + 64])
lines.append(m_end.group(0))
print("\n".join(lines) + "\n")
PY
}

write_key_from_env() {
  local inline=""
  for name in \
    TRANSOVO_SSH_PRIVATE_KEY \
    TRANSOVO_SSH_KEY \
    COOLIFY_SSH_KEY \
    TRANSOVO_COOLIFY_SSH_KEY; do
    if [[ -n "${!name:-}" ]]; then
      inline="${!name}"
      break
    fi
  done
  if [[ -z "$inline" ]]; then
    return 1
  fi
  mkdir -p "$(dirname "$KEY_FILE")"
  reflow_pem <<<"$inline" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  return 0
}

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"

if [[ -f "${HOME}/.ssh/cursor_hetzner_ed25519" ]]; then
  KEY_FILE="${HOME}/.ssh/cursor_hetzner_ed25519"
elif [[ -f "$KEY_FILE" ]]; then
  :
elif write_key_from_env; then
  :
else
  echo "ensure-coolify-ssh: no key (set TRANSOVO_SSH_PRIVATE_KEY or COOLIFY_SSH_KEY, or provide ~/.ssh/cursor_hetzner_ed25519)" >&2
  exit 1
fi

ALIAS="${COOLIFY_SSH_HOST_ALIAS:-coolify-server}"
if ! grep -q "$MARKER" "$SSH_CONFIG" 2>/dev/null; then
  {
    echo ""
    echo "$MARKER"
    echo "Host $ALIAS"
    echo "  HostName $HOST"
    echo "  User $USER"
    echo "  IdentityFile $KEY_FILE"
    echo "  StrictHostKeyChecking accept-new"
    echo "  BatchMode yes"
  } >>"$SSH_CONFIG"
  chmod 600 "$SSH_CONFIG"
fi

export COOLIFY_SSH_HOST_ALIAS="$ALIAS"
export COOLIFY_SSH_RESOLVED_HOST="$HOST"
export COOLIFY_SSH_RESOLVED_USER="$USER"
export COOLIFY_SSH_IDENTITY_FILE="$KEY_FILE"

if ssh -o BatchMode=yes -o ConnectTimeout=15 "$ALIAS" true 2>/dev/null; then
  echo "ensure-coolify-ssh: OK ($USER@$HOST via $ALIAS)"
  exit 0
fi

echo "ensure-coolify-ssh: ssh test failed ($USER@$HOST)" >&2
exit 1
