# Transovo Python LiveKit voice worker — independent from transovo-web.
# Coolify: Base Directory = voice-runtime-python, Dockerfile = Dockerfile.
# Local from repo root: docker build -f voice-runtime-python/Dockerfile voice-runtime-python

FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc ffmpeg curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY scripts/start-transovo-voice-worker.sh ./scripts/start-transovo-voice-worker.sh
COPY transovo_voice ./transovo_voice

RUN chmod +x ./scripts/start-transovo-voice-worker.sh

RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir \
    "livekit-agents[openai]~=1.8" \
    "livekit-plugins-deepgram>=0.6,<1" \
    "livekit-plugins-noise-cancellation>=0.2,<0.4" \
    "httpx>=0.27,<0.29" \
    "pydantic>=2.7,<3" \
    "python-dotenv>=1.0,<2" \
  && pip install --no-cache-dir -e .

ENV PYTHONUNBUFFERED=1
ENV PORT=8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/" || exit 1

EXPOSE 8081

CMD ["./scripts/start-transovo-voice-worker.sh"]
