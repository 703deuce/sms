# Transovo Python LiveKit voice worker — independent from transovo-web.
# Optional MCTB SIP adapter (Asterisk) starts when MCTB_SIP_ADAPTER_ENABLED=1.
# Build: docker build -f voice-runtime-python/Dockerfile .

FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    asterisk \
    asterisk-core-sounds-en \
    ca-certificates \
    curl \
    ffmpeg \
    gcc \
    gettext-base \
    sox \
  && rm -rf /var/lib/apt/lists/*

COPY voice-runtime-python/pyproject.toml voice-runtime-python/README.md ./
COPY voice-runtime-python/transovo_voice ./transovo_voice

RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir \
    "livekit-agents[openai]>=1.2.0,<2" \
    "livekit-plugins-noise-cancellation>=0.2,<0.4" \
    "httpx>=0.27,<0.29" \
    "pydantic>=2.7,<3" \
    "python-dotenv>=1.0,<2" \
    "pyst2==0.5.1" \
  && pip install --no-cache-dir -e .

COPY mctb-sip-adapter/asterisk /etc/asterisk-templates/
COPY mctb-sip-adapter/agi /opt/mctb-sip-adapter/agi/
COPY mctb-sip-adapter/docker-entrypoint.sh /docker-entrypoint.sh
COPY voice-runtime-python/start-with-mctb-sip.sh /start-with-mctb-sip.sh

RUN chmod +x /docker-entrypoint.sh /start-with-mctb-sip.sh /opt/mctb-sip-adapter/agi/mctb_inbound.py \
  && mkdir -p /var/spool/asterisk/mctb-audio /var/log/asterisk /var/lib/asterisk/agi-bin

ENV PYTHONUNBUFFERED=1
ENV LIVEKIT_AGENT_NAME=[REDACTED]
ENV MCTB_SIP_UDP_PORT=5070
ENV MCTB_SIP_ADAPTER_ENABLED=1

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8081/', timeout=3)"

EXPOSE 8081
EXPOSE 5070/udp
EXPOSE 10000-10100/udp

CMD ["/start-with-mctb-sip.sh"]
