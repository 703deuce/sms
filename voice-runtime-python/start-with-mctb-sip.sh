#!/bin/bash
# Starts Asterisk MCTB SIP adapter when MCTB_SIP_ADAPTER_ENABLED=1 (transovo-voice Coolify app).
set -euo pipefail

start_asterisk_adapter() {
  if [ "${MCTB_SIP_ADAPTER_ENABLED:-0}" != "1" ]; then
    return 0
  fi

  echo "[mctb-sip] starting Asterisk adapter (SIP UDP ${MCTB_SIP_UDP_PORT:-5070})"
  /docker-entrypoint.sh asterisk -g
  sleep 2
  if ! asterisk -rx "core show version" >/dev/null 2>&1; then
    echo "[mctb-sip] Asterisk failed to start"
    exit 1
  fi
  echo "[mctb-sip] Asterisk running"
}

start_asterisk_adapter
exec python -m transovo_voice.main start
