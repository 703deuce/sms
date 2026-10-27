# Streamer — full-VOD transcription cost design (Rick)

**Prerequisite:** regular clipper gaps done; Stage 1 storage/reliability (`STREAMER-RICK-STAGES.md`).  
**Goal:** Full-transcript quality for Luna rerank — entire VOD audio, chunked &lt;100 MB. **No Groq.**  
**Logging:** `[clipper:stream]` — `collab_detected`, `transcribe_chunk`, `transcribe_vod` (provider, gpuSeconds, costUsdEst).

---

## Target pipeline

```
IMPORT: audio-only (full VOD) in object storage
        │
        ▼
COLLAB DETECT → solo: provider=modal | collab: provider=modal_diarize
        │
        ▼
FULL-VOD ASR (Modal StreamTranscriber on L4, faster-whisper batched)
  • STREAM_WHISPER_GPU_MODEL=large-v3-turbo (default for streams)
  • Collab: pyannote speaker-diarization-3.1 on GPU (HF_TOKEN on Modal — see benchmark doc)
  • Modal errors/timeouts → Deepgram nova-3 full chunk (fallback)
  • merge_words → full project transcript
        │
        ▼
RANK → Luna on full words (audio/chat signals as fusion weights)
        │
        ▼
RENDER → Deepgram nova-3 + diarize on final clips only (captions)
```

**Regular clipper** keeps existing `Transcriber` + `TRANSCRIBE_PROVIDER` / `gpu/modal_provider.py` — unchanged.

---

## Provider / env

| Env | Default | Meaning |
|-----|---------|---------|
| `STREAM_WHISPER_GPU_MODEL` | `large-v3-turbo` | Modal whisper model for stream chunks |
| `STREAM_TRANSCRIBE_PROVIDER` | `modal` | `modal` or `deepgram` (test/emergency) |
| `MODAL_STREAM_SCALEDOWN_S` | `30` | StreamTranscriber idle scaledown |
| `MODAL_L4_USD_PER_GPU_S` | `0.000542` | Logged $ estimate from gpuSeconds |
| `STREAM_MODAL_TRANSCRIBE_TIMEOUT_S` | `900` | Worker-side guard (Modal class timeout 3600) |
| `HF_TOKEN` | — | **On Modal secret** for pyannote (Rick accepts HF license) |
| `DEEPGRAM_CAPTION_MODEL` | `nova-3` | Final-clip captions only |

**Code:** `modal_app/transcribe.py` (`StreamTranscriber`), `streamer/modal_transcribe.py`, `streamer/transcribe_stream.py`, `streamer/collab_detect.py`.

**Benchmark:** `docs/clips/streamer/STREAMER-MODAL-TRANSCRIBE-BENCHMARK.md` + `worker/scripts/stream_modal_transcribe_benchmark.py`.

---

## Superseded

- Groq full-VOD plan (`groq_transcribe.py` not used on stream path).
- Selective two-pass Deepgram sampling.
