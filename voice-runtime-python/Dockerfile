# Transovo Python LiveKit voice worker — independent from transovo-web.
# Build: docker build -f voice-runtime-python/Dockerfile .
# Run:   docker run --env-file voice-runtime-python/.env.example ...

FROM python:3.12-slim-bookworm

WORKDIR /app

# Build deps for livekit-agents / audio stack wheels when needed.
RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc ffmpeg \
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
  && pip install --no-cache-dir -e .

ENV PYTHONUNBUFFERED=1
ENV LIVEKIT_AGENT_NAME=transovo-voice-runtime

# LiveKit agent health server (internal — no public domain required).
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8081/', timeout=3)"

EXPOSE 8081

CMD ["python", "-m", "transovo_voice.main", "start"]
