#!/bin/bash
set -euo pipefail

: "${TRANSOVO_BACKEND_URL:?TRANSOVO_BACKEND_URL is required}"
: "${TRANSOVO_INTERNAL_API_KEY:?TRANSOVO_INTERNAL_API_KEY is required}"

export RTP_START_PORT="${RTP_START_PORT:-10000}"
export RTP_END_PORT="${RTP_END_PORT:-10100}"
# 5070 avoids conflict with LiveKit SIP on 5060 at voice.transovo.ai
export SIP_UDP_PORT="${MCTB_SIP_UDP_PORT:-${SIP_UDP_PORT:-5070}}"

if [ -z "${EXTERNAL_SIP_IP:-}" ]; then
  resolve_host="${MCTB_SIP_ADAPTER_HOST:-voice.transovo.ai}"
  EXTERNAL_SIP_IP="$(getent ahostsv4 "$resolve_host" 2>/dev/null | awk 'NR==1 {print $1}')"
fi
: "${EXTERNAL_SIP_IP:?EXTERNAL_SIP_IP is required — set explicitly or ensure MCTB_SIP_ADAPTER_HOST resolves}"

render_template() {
  local src="$1"
  local dest="$2"
  envsubst <"$src" >"$dest"
}

render_template /etc/asterisk-templates/pjsip.conf.template /etc/asterisk/pjsip.conf
render_template /etc/asterisk-templates/extensions.conf.template /etc/asterisk/extensions.conf
render_template /etc/asterisk-templates/rtp.conf.template /etc/asterisk/rtp.conf

cp /etc/asterisk-templates/modules.conf /etc/asterisk/modules.conf

mkdir -p /var/lib/asterisk/agi-bin /var/lib/asterisk/documentation /var/run/asterisk /var/spool/asterisk/mctb-audio /var/log/asterisk
if [ -d /usr/share/asterisk/documentation ]; then
  cp -rn /usr/share/asterisk/documentation/. /var/lib/asterisk/documentation/ 2>/dev/null || true
fi
ln -sf /opt/mctb-sip-adapter/agi/mctb_inbound.py /var/lib/asterisk/agi-bin/mctb_inbound.py

echo "mctb-sip-adapter: external_ip=${EXTERNAL_SIP_IP} sip_udp=${SIP_UDP_PORT} rtp=${RTP_START_PORT}-${RTP_END_PORT}"
echo "mctb-sip-adapter: backend=${TRANSOVO_BACKEND_URL}"

exec "$@"
