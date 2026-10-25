FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download faster-whisper small.en (M3 default; override with ASR_MODEL)
ENV HF_HOME=/models/hf
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8', download_root='/models/whisper')"

COPY worker/prototype/v3/transcribe.py /app/transcribe.py
COPY worker/clips_worker /app/clips_worker

ENV PYTHONUNBUFFERED=1
ENV ASR_MODEL=small.en
CMD ["python", "-m", "clips_worker.main"]
