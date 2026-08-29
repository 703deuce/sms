#!/bin/bash
# transovo-voice production start.
# - MCTB_SIP_ADAPTER_ENABLED=1 → Asterisk on UDP 5070 (MCTB press-1 SIP path)
# - MCTB_SIP_ADAPTER_ONLY=1     → Asterisk only (no LiveKit worker — use for MCTB spike)
# - default                   → Asterisk (if enabled) + LiveKit worker (AI receptionist / other voice)
set -euo pipefail

start_asterisk_adapter() {
  if [ "${MCTB_SIP_ADAPTER_ENABLED:-0}" != "1" ]; then
    echo "[mctb-sip] adapter disabled (MCTB_SIP_ADAPTER_ENABLED!=1)"
    return 0
  fi

  echo "[mctb-sip] starting Asterisk adapter on UDP ${MCTB_SIP_UDP_PORT:-5070}"
  echo "[mctb-sip] LiveKit worker is separate — MCTB inbound uses Asterisk, not LiveKit rooms"
  /docker-entrypoint.sh asterisk -g
  sleep 2
  if ! asterisk -rx "core show version" >/dev/null 2>&1; then
    echo "[mctb-sip] Asterisk failed to start"
    exit 1
  fi
  echo "[mctb-sip] Asterisk running: $(asterisk -rx 'core show version' 2>/dev/null | head -1)"
}

start_asterisk_adapter

if [ "${MCTB_SIP_ADAPTER_ONLY:-0}" = "1" ]; then
  echo "[mctb-sip] MCTB_SIP_ADAPTER_ONLY=1 — skipping LiveKit worker"
  exec asterisk -f
fi

echo "[transovo-voice] starting LiveKit worker (AI / receptionist — not used for MCTB SIP press-1)"
exec python -m transovo_voice.main start
