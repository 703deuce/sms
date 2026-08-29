#!/bin/bash
set -euo pipefail

: "${EXTERNAL_SIP_IP:?EXTERNAL_SIP_IP is required — public IPv4 reachable by Telnyx}"
: "${TRANSOVO_BACKEND_URL:?TRANSOVO_BACKEND_URL is required}"
: "${TRANSOVO_INTERNAL_API_KEY:?TRANSOVO_INTERNAL_API_KEY is required}"

export EXTERNAL_SIP_IP
export RTP_START_PORT="${RTP_START_PORT:-10000}"
export RTP_END_PORT="${RTP_END_PORT:-10100}"
export SIP_UDP_PORT="${SIP_UDP_PORT:-5060}"
export TELNYX_SIP_IDENTIFY_IPS="${TELNYX_SIP_IDENTIFY_IPS:-0.0.0.0/0}"

render_template() {
  local src="$1"
  local dest="$2"
  envsubst <"$src" >"$dest"
}

render_template /etc/asterisk-templates/pjsip.conf.template /etc/asterisk/pjsip.conf
render_template /etc/asterisk-templates/extensions.conf.template /etc/asterisk/extensions.conf
render_template /etc/asterisk-templates/rtp.conf.template /etc/asterisk/rtp.conf

cp /etc/asterisk-templates/modules.conf /etc/asterisk/modules.conf

cat >/etc/asterisk/asterisk.conf <<EOF
[directories]
astetcdir => /etc/asterisk
astmoddir => /usr/lib/asterisk/modules
astvarlibdir => /var/lib/asterisk
astdbdir => /var/lib/asterisk
astkeydir => /var/lib/asterisk
astdatadir => /var/lib/asterisk
astagidir => /var/lib/asterisk/agi-bin
astspooldir => /var/spool/asterisk
astrundir => /var/run/asterisk
astlogdir => /var/log/asterisk

[options]
verbose = 3
debug = 0
transmit_silence = yes
EOF

ln -sf /opt/mctb-sip-adapter/agi/mctb_inbound.py /var/lib/asterisk/agi-bin/mctb_inbound.py

echo "mctb-sip-adapter: external_ip=${EXTERNAL_SIP_IP} sip_udp=${SIP_UDP_PORT} rtp=${RTP_START_PORT}-${RTP_END_PORT}"
echo "mctb-sip-adapter: backend=${TRANSOVO_BACKEND_URL}"

exec "$@"
