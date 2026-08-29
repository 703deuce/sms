# Minimal MCTB SIP terminator — dumb telephony adapter for Telnyx FQDN ingress.
# NOT routed through Coolify HTTP proxy. Use host networking or explicit SIP/RTP ports.

FROM debian:bookworm-slim

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    asterisk \
    asterisk-core-sounds-en \
    ca-certificates \
    curl \
    gettext-base \
    python3 \
    python3-pip \
    sox \
    wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/mctb-sip-adapter

COPY agi/requirements.txt ./agi/
RUN pip3 install --no-cache-dir --break-system-packages -r agi/requirements.txt

COPY asterisk/ /etc/asterisk-templates/
COPY agi/ /opt/mctb-sip-adapter/agi/
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh /opt/mctb-sip-adapter/agi/mctb_inbound.py \
  && mkdir -p /var/spool/asterisk/mctb-audio /var/log/asterisk

EXPOSE 5060/udp 5060/tcp 10000-10100/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["asterisk", "-f", "-vvv", "-c"]
