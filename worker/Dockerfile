FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsm6 libxext6 libglib2.0-0 libegl1 libgl1 libgles2 curl build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY worker/requirements-m4.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir 'numpy==1.26.4'

ENV HF_HOME=/models/hf
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8', download_root='/models/whisper')"

COPY worker/prototype/v3 /app/v3
COPY worker/scripts/download-models.sh /tmp/download-models.sh
RUN chmod +x /tmp/download-models.sh && bash /tmp/download-models.sh /app/v3

COPY worker/prototype/v3/transcribe.py /app/transcribe.py
COPY worker/clips_worker /app/clips_worker
COPY worker/tests /app/tests

ENV PYTHONPATH=/app
RUN pip install --no-cache-dir pytest && pytest -q /app/tests/test_caption_parity.py

ENV PYTHONUNBUFFERED=1
ENV ASR_MODEL=small.en
ENV SPEAKERCROP_DIR=/app/v3
ENV TRANSCRIBE_SCRIPT=/app/transcribe.py

CMD ["python", "-m", "clips_worker.main"]
