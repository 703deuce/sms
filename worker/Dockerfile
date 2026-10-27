FROM python:3.11-slim-bookworm

ARG GIT_COMMIT=unknown

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsm6 libxext6 libglib2.0-0 libegl1 libgl1 libgles2 curl build-essential \
    fontconfig ca-certificates fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ARG GIT_COMMIT
ENV CLIPS_WORKER_GIT_SHA=${GIT_COMMIT}
RUN echo "${GIT_COMMIT}" > /app/CLIPS_WORKER_GIT_SHA
COPY worker/requirements-m4.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir 'numpy==1.26.4'

ENV HF_HOME=/models/hf
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8', download_root='/models/whisper')"

# Kenney CC0 export SFX live under assets/sfx/ (see clips_worker/export_sfx.py).
COPY worker/assets /app/assets
COPY worker/prototype/v3 /app/v3
# Bookworm has no fonts-montserrat apt package — fetch static Black for ASS + fontconfig.
RUN set -eux; \
    mkdir -p /usr/share/fonts/truetype/montserrat /app/v3/fonts; \
    curl -fsSL -o /usr/share/fonts/truetype/montserrat/Montserrat-Black.ttf \
      'https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Black.ttf'; \
    cp /usr/share/fonts/truetype/montserrat/Montserrat-Black.ttf /app/v3/fonts/Montserrat-Black.ttf; \
    fc-cache -f; \
    fc-list | grep -i montserrat | head -3; \
    test -s /app/v3/fonts/Montserrat-Black.ttf
COPY worker/prototype /app/prototype
COPY worker/scripts/download-models.sh /tmp/download-models.sh
RUN chmod +x /tmp/download-models.sh && bash /tmp/download-models.sh /app/v3

COPY worker/prototype/v3/transcribe.py /app/transcribe.py
COPY worker/clips_worker /app/clips_worker
COPY worker/modal_app /app/modal_app
COPY worker/scripts /app/scripts
COPY worker/tests /app/tests

ENV PYTHONPATH=/app
ENV CLIPS_WORKER_ROOT=/app
RUN pip install --no-cache-dir pytest \
    && pytest -q /app/tests/test_caption_parity.py /app/tests/test_clip_layout_env.py \
        /app/tests/test_subject_follow_crop_track.py /app/tests/test_detect_facecam_sampling.py \
        /app/tests/test_studio_sound_e2e.py /app/tests/test_multiperson_clipper.py \
        /app/tests/test_reframe_director.py /app/tests/test_reframe_ffmpeg_graphs.py \
        /app/tests/test_reframe_core_pure.py /app/tests/test_reframe_v2_gate.py \
        /app/tests/test_director_cfg_live.py /app/tests/test_speakercrop_crop_track_in.py \
        /app/tests/test_render_ai_meta.py /app/tests/test_chat_source.py \
        /app/tests/test_reframe_model_names.py /app/tests/test_layout_router.py \
        /app/tests/test_reframe_integration.py /app/tests/test_person_count_probe.py \
        /app/tests/test_reframe_person_det.py /app/tests/test_polish_render_sync.py \
        /app/tests/test_zoom_filtergraph_valid.py /app/tests/test_worker_fonts.py \
        /app/tests/test_export_sfx.py /app/tests/test_loop_friendly_trim.py \
        /app/tests/test_audio_first_ingest.py /app/tests/test_stream_render_segment_checkpoint.py

ENV PYTHONUNBUFFERED=1
ENV ASR_MODEL=small.en
ENV SPEAKERCROP_DIR=/app/v3
ENV TRANSCRIBE_SCRIPT=/app/transcribe.py

CMD ["python", "-m", "clips_worker.main"]
