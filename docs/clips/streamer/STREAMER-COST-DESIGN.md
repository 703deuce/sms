# Streamer — full-VOD transcription cost design (Rick)

**Prerequisite:** regular clipper gaps done; Stage 1 storage/reliability (`STREAMER-RICK-STAGES.md`).  
**Goal:** **Full-transcript quality** for ranking — transcribe the **entire VOD audio**, then Luna rerank on the full transcript. **No** two-pass sampling / selective Deepgram windows.  
**Logging:** `[clipper:stream]` — `transcribe_vod` (provider, audio minutes, cost estimate) and per-clip `caption_clip` when Deepgram runs on finals.

---

## Target pipeline

```
IMPORT: audio-only (full VOD) in object storage
        │
        ▼
FULL-VOD ASR (Groq whisper-large-v3-turbo, chunked <100 MB)
  • plan_chunks + ffmpeg_slice_opus (shrink slice until ≤ STREAM_CHUNK_MAX_BYTES)
  • transcribe_stream_audio_request per chunk (Groq default when GROQ_API_KEY set)
  • Deepgram fallback on Groq errors; STREAM_TRANSCRIBE_PROVIDER overrides auto
  • merge_words → full project transcript
        │
        ▼
RANK (signals are features, not pre-filters)
  • audio_signal_per_second + chat spikes + viewer cues + full transcript signal
  • fuse_moments + gpt-6-luna (llm_rank) on full words
        │
        ▼
STREAM_RENDER — caption-grade words on chosen clips only
  • Deepgram nova-3 (DEEPGRAM_CAPTION_MODEL) on padded clip audio slice
  • Fallback: slice full-VOD words if Deepgram unavailable
```

**Cost sketch (4 h VOD):** Groq ~$0.16 at $0.04/audio-hour + Deepgram only on ~12 short clips (caption pass), not 240 minutes of nova-3.

---

## Provider abstraction

| Env | Default | Meaning |
|-----|---------|---------|
| `STREAM_TRANSCRIBE_PROVIDER` | auto | `groq` \| `deepgram` \| `local` — auto prefers Groq when `GROQ_API_KEY` is set, else Deepgram when `DEEPGRAM_API_KEY` is set |
| `GROQ_API_KEY` | — | Required for Groq full-VOD path |
| `GROQ_WHISPER_MODEL` | `whisper-large-v3-turbo` | Groq model id |
| `GROQ_USD_PER_AUDIO_HOUR` | `0.04` | Logged estimate only |
| `STREAMER_CHUNK_MAX_BYTES` | `104857600` | Per-request upload cap (100 MB) |
| `DEEPGRAM_CAPTION_MODEL` | `nova-3` | Final-clip caption pass only (`render_job`) |
| `DEEPGRAM_USD_PER_MIN` | `0.006` | Logged estimate when provider is deepgram for full VOD |

**Code:** `streamer/transcribe_stream.py`, `groq_transcribe.py`, `streamer/chunk_transcribe.py`, `streamer/chunking.py`.

**Log line (after analyze merge):**

```text
[clipper:stream] transcribe_vod vodId=… projectId=… provider=groq audioMinutes=240.0 costUsdEst=0.1600 fallback=none
```

---

## What exists today

| Module | Role |
|--------|------|
| `analyze_job.py` | Full `plan_chunks` → transcribe all chunks → `log_stream_transcribe_summary` → `rank_moments` |
| `chunk_transcribe.py` | Per-chunk retry → `transcribe_stream_audio_request` |
| `rank.py` | Audio + chat + transcript signals → fusion + Luna |
| `render_job.py` | Deepgram caption on each final clip; else VOD word slice |

**Superseded:** selective two-pass / `STREAMER_TRANSCRIBE_SCOPE=selective` design (do not implement).

---

## Acceptance

- Full VOD transcribed (all chunks) before `rank_moments`.
- Luna sees complete transcript text.
- Captions on exported clips use nova-3 when `DEEPGRAM_API_KEY` is set.
- Groq outage → logged fallback to Deepgram per chunk; VOD still completes.

---

## Related docs

- `STREAMER-RICK-STAGES.md`
- `RELIABILITY-RUNS.md`
