# Minimal MCTB SIP terminator — dumb telephony adapter for Telnyx FQDN ingress.
# NOT routed through Coolify HTTP proxy. Use host networking (recommended) or publish UDP ports.
# Asterisk is not packaged for Debian 12 (bookworm) — use bullseye (11).
# Build from repo root: docker build -f mctb-sip-adapter/Dockerfile .

FROM debian:bullseye-slim

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

COPY mctb-sip-adapter/agi/requirements.txt ./agi/
RUN pip3 install --no-cache-dir -r agi/requirements.txt

COPY mctb-sip-adapter/asterisk/ /etc/asterisk-templates/
COPY mctb-sip-adapter/agi/ /opt/mctb-sip-adapter/agi/
COPY mctb-sip-adapter/docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh /opt/mctb-sip-adapter/agi/mctb_inbound.py \
  && mkdir -p /var/spool/asterisk/mctb-audio /var/log/asterisk

ENV MCTB_SIP_UDP_PORT=5070

EXPOSE 5070/udp 10000-10100/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["asterisk", "-f", "-vvv", "-c"]
