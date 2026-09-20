#!/usr/bin/env bash
# Lists ScrapingDog-related env *names* on production web + scheduler containers (no secret values).
set -euo pipefail

HOST_ALIAS="${COOLIFY_SSH_HOST:-coolify-server}"
WEB_UUID="${COOLIFY_WEB_UUID:-ds8s3hjin60qs6g7s0iqkixs}"

if [[ -z "${COOLIFY_SSH_KEY:-}" ]]; then
  echo "COOLIFY_SSH_KEY not set — skipping remote audit"
  exit 0
fi

KEY_FILE="${HOME}/.ssh/cursor_coolify"
mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"
# Reflow single-line PEM if needed (Coolify secret format).
python3 - <<'PY' > "$KEY_FILE"
import os, re, sys
key = os.environ.get("COOLIFY_SSH_KEY", "")
key = key.strip()
if "BEGIN" in key and "\n" not in key:
    m = re.match(r"(-----BEGIN [^-]+-----)(.+)(-----END [^-]+-----)", key)
    if m:
        body = m.group(2)
        chunks = [body[i:i+64] for i in range(0, len(body), 64)]
        key = m.group(1) + "\n" + "\n".join(chunks) + "\n" + m.group(3) + "\n"
print(key)
PY
chmod 600 "$KEY_FILE"

if ! grep -q "Host coolify-server" "${HOME}/.ssh/config" 2>/dev/null; then
  cat >> "${HOME}/.ssh/config" <<EOF
Host coolify-server
  HostName 128.140.102.51
  User root
  IdentityFile ${KEY_FILE}
  StrictHostKeyChecking accept-new
EOF
  chmod 600 "${HOME}/.ssh/config"
fi

echo "[audit] Running containers (name filter: ${WEB_UUID})"
ssh -o BatchMode=yes "$HOST_ALIAS" "docker ps --format '{{.Names}}' | grep -E '${WEB_UUID}|tgjridm6vrmrgljkfrr0rpjn' || true"

for name in $(ssh -o BatchMode=yes "$HOST_ALIAS" "docker ps --format '{{.Names}}' | grep -E '${WEB_UUID}|tgjridm6vrmrgljkfrr0rpjn' || true"); do
  echo ""
  echo "[audit] Env names matching SCRAP|DOG in container: $name"
  ssh -o BatchMode=yes "$HOST_ALIAS" "docker inspect \"$name\" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed 's/=.*//' | grep -iE 'scrap|dog' || echo '(none)'"
done
