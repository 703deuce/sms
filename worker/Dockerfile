FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY worker/prototype/v3/transcribe.py /app/transcribe.py
COPY worker/clips_worker /app/clips_worker

ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "clips_worker.main"]
