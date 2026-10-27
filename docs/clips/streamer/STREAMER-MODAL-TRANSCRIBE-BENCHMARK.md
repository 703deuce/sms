# Streamer Modal transcribe benchmark

**Prereq:** `modal deploy -m modal_app.app` with `StreamTranscriber` on L4; worker has Modal token; Deepgram for comparison.

## Rick setup (collab diarization)

- **No Groq** on streamer path.
- **Solo full-VOD:** Modal `StreamTranscriber` + `STREAM_WHISPER_GPU_MODEL=large-v3-turbo` (default).
- **Collab full-VOD:** same + `diarize=true` (pyannote `speaker-diarization-3.1`).
- **HF token required on Modal** for pyannote: create a Modal secret (e.g. `transovo-hf`) with `HF_TOKEN` after accepting the model license on Hugging Face. We do not create accounts for you.
- **Scaledown:** `MODAL_STREAM_SCALEDOWN_S=30` on `StreamTranscriber` (clipper `Transcriber` keeps `MODAL_SCALEDOWN_S`).

## Run benchmark (one ~4h solo + one collab VOD)

1. Paste/import both VODs; note signed URLs to full `audio.opus` in object storage (or use a 5-minute slice URL).
2. On the worker:

```bash
cd /app/worker
python scripts/stream_modal_transcribe_benchmark.py \
  --solo-audio-url "<signed-solo-audio-url>" \
  --collab-audio-url "<signed-collab-audio-url>" \
  --sample-start-s 3600 \
  --sample-duration-s 300
```

3. Record JSON output: `modalGpuSeconds`, `modalColdStartS`, `modalCostUsdEst`, `tokenMismatchVsDeepgram` (5-min proxy vs Deepgram nova-3), `distinctSpeakers` / `diarizationSanity` for collab.

Extrapolate full-VOD cost: sum chunk `gpuSeconds` from `[clipper:stream] transcribe_chunk` logs × `MODAL_L4_USD_PER_GPU_S`, or scale 5-min sample by audio minutes.

## Logging

- Per chunk: `[clipper:stream] transcribe_chunk … provider= modal|modal_diarize gpuSeconds= … costUsdEst= …`
- Per VOD: `[clipper:stream] transcribe_vod … gpuSeconds= … coldStartS= …`
- Deepgram fallback: `falling_back=deepgram` on Modal errors/timeouts; final clips still use Deepgram nova-3 captions.
