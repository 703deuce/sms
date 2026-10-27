# Streamer — two-pass transcription cost design (Rick)

**Prerequisite:** regular clipper gaps done; Stage 1 storage/reliability (`STREAMER-RICK-STAGES.md`) in progress or complete.  
**Goal:** Do **not** transcribe the whole VOD. Target **~45–60 minutes of Deepgram** per **4 h** VOD (~20–25% of runtime).  
**Logging:** `[clipper:stream]` — `vodId`, `projectId`, `jobId`, `stage`, `candidateWindows`, `transcribeMinutes`, `transcribeCostUsdEst`, `transcribeMode`.

---

## Target pipeline (Eklipse-style)

```
IMPORT: audio-only (full VOD) in object storage
        │
        ▼
PASS 1 — cheap (local + chat, full timeline, no ASR)
  • audio_signal_per_second (ffmpeg ebur128 → per-second z-score)     [signals/audio.py]
  • optional: extend audio for voice-energy / laugh-scream bands (ffmpeg astats/RMS) — gap
  • chat_signal_per_second (message rate + hype)                       [signals/chat.py]
  • chat_clip_cue_seconds (!clip, clip it)                           [clip_cues.py]
  • viewer_clips_signal + viewer_clip_cue_seconds (Twitch/Kick)        [signals/viewer_clips.py, clip_cues.py]
  • fuse → per-second curve (no transcript weight in pass 1)         [fusion._combined_curve pattern]
  • pick top ~30–40 windows of 60–120 s, merge overlaps              [NEW: candidate_windows.py]
        │
        ▼
PASS 2 — expensive (Deepgram + Luna)
  • For each window: ffmpeg_slice_opus → transcribe_chunk_with_retry   [chunk_transcribe.py → transcribe_provider → deepgram]
  • merge_words into partial transcript (gaps between windows omitted or zero-filled in signals only)
  • rank_moments + llm_rank on transcribed text only                 [rank.py, llm_rank.py, fusion.fuse_moments]
  • insert clip rows → STREAM_RENDER
```

**Fallback:** `STREAMER_TRANSCRIBE_SCOPE=full` (env) or `settings.streamer.transcribeScope: "full"` restores today’s behaviour (transcribe all `plan_chunks` over full duration).

---

## What exists today (do not duplicate)

| Module | Role today | Reuse in two-pass |
|--------|------------|-------------------|
| `streamer/analyze_job.py` | **Full-VOD** `plan_chunks` → transcribe **every** chunk → then `rank_moments` | **Reorder:** pass 1 before any `transcribe_chunk_with_retry`; pass 2 only on `candidate_windows` |
| `streamer/chunking.py` | `plan_chunks`, `ffmpeg_slice_opus`, `merge_words` | Pass 2: one slice per **candidate window** (not uniform 15 min grid) |
| `streamer/chunk_transcribe.py` | Per-chunk Deepgram/whisper + retry | Unchanged; call per window |
| `streamer/signals/audio.py` | ebur128 momentary → 1 Hz normalized | Pass 1 primary audio signal |
| `streamer/signals/chat.py` | Chat rate + hype spikes | Pass 1 (fetch chat **before** transcribe — already `get_chat` parallel in analyze) |
| `streamer/clip_cues.py` | `!clip` chat + viewer clip times; streamer phrase cues need **words** | Pass 1: chat + viewer cues only; pass 2: add `streamer_clip_cue_seconds` after ASR inside windows |
| `streamer/fusion.py` | Peak pick → short clips (15–60 s default) | Pass 1: reuse peak/window logic at **60–120 s**; pass 2: existing clip fusion + LLM on words |
| `streamer/rank.py` | `rank_moments` wires signals + `fuse_moments` + `make_llm_ranker` | Pass 2 entrypoint; pass 1 → new `rank_candidate_windows()` without words |
| `streamer/llm_rank.py` | `gpt-6-luna` via `picker.llm.chat_json` | Pass 2 only (batch over fusion candidates) |
| `transcribe_provider.py` / `deepgram_transcribe.py` | Deepgram listen API | Pass 2 only |

**Anti-pattern:** running `transcript_signal_per_second` on the full timeline before ASR — it requires words. In selective mode, omit transcript signal in pass 1; after pass 2, transcript signal runs on merged words (sparse OK).

---

## Pass 1 — candidate windows (new logic, small module)

**Proposed:** `worker/clips_worker/streamer/candidate_windows.py` (single home; no second fusion implementation).

1. Build signals dict (audio, chat, viewerClips, clipCues from chat/viewer only).
2. Weights: raise `clipCues` + `chat` + `audio`; set `transcript: 0`.
3. `_combined_curve` + `_local_maxima` (import from `fusion.py` or move shared helpers to `signals/curve.py` if needed — **prefer import**, don’t copy).
4. From peaks, grow windows **60–120 s** (config `STREAMER_CANDIDATE_MIN_S` / `MAX_S`, default 60 / 120).
5. Sort by peak score; take top `STREAMER_CANDIDATE_MAX` (default **36**); merge IoU/overlap > 0.35.
6. Persist in `StreamVod.state.candidateWindows: [{startMs,endMs,score}]` for resume.
7. Log: `[clipper:stream] pass1_candidates vodId=… count=… totalWindowMin=…`

**Chat timing:** Resolve chat in parallel with pass 1 audio scan (move `get_chat` **before** pass 1, not after full transcribe as today).

---

## Pass 2 — selective transcribe + rerank

For each window in `candidateWindows` (skip if `state.chunks` already has `wordsKey` for that window id):

- `ffmpeg_slice_opus(audio_path, …, start_ms, end_ms)`
- `transcribe_chunk_with_retry` (Deepgram when `resolve_transcribe_provider() == "deepgram"`)
- Store words with correct `offset_ms`
- `merge_words` over windows (overlap trim like today)

Then:

- `rank_moments(audio_path, words, …)` with full `use_llm=True` → `make_llm_ranker` / `fuse_moments`
- Optional: cap final clips to `streamer.clipCount` (12 default)

Log after pass 2:

```text
[clipper:stream] pass2_transcribe vodId=… windows=36 transcribeMinutes=52.3 engine=deepgram costUsdEst=0.31
```

**Cost estimate (log only, no billing):**  
`transcribeMinutes * STREAMER_DEEPGRAM_USD_PER_MIN` (env default e.g. `0.006` — tune from Deepgram list price). Record optional row in `ai_usage` if provider already does for listen calls.

**SLO check:** for `duration_h=4`, warn if `transcribeMinutes` > 70 or < 35 (config band).

---

## Configuration

| Flag | Default | Meaning |
|------|---------|---------|
| `STREAMER_TRANSCRIBE_SCOPE` | `selective` | `selective` = two-pass; `full` = legacy full chunk grid |
| `STREAMER_CANDIDATE_MAX` | `36` | Max merged windows |
| `STREAMER_CANDIDATE_MIN_S` / `MAX_S` | `60` / `120` | Window length bounds |
| `STREAMER_DEEPGRAM_USD_PER_MIN` | `0.006` | Logged estimate only |
| Project `settings.streamer.transcribeScope` | inherit env | Per-project override |

Zod: extend `lib/streamer/settings.ts` with optional `transcribeScope`, `candidateMax` when implementing.

---

## `analyze_job.py` migration (single job, idempotent)

| Step | selective | full (fallback) |
|------|-----------|-----------------|
| Load audio | ✓ | ✓ |
| Chat fetch | parallel, early | same |
| Transcribe | candidate windows only | all `plan_chunks` (current) |
| Rank | after partial words | after full words |
| State keys | `candidateWindows`, `chunks` keyed by window index | `chunks` 0..N |

Re-run after worker crash: skip windows with `wordsKey`; recompute pass 1 only if `candidateWindows` missing.

---

## Acceptance (cost)

On a **4 h** paste VOD (production):

- `transcribeMinutes` in **45–60** range (logged).
- Clip quality subjectively comparable to one full-transcribe control (same VOD, `transcribeScope=full`) — owner A/B, not automated in CI.

---

## Related docs

- Storage / no full video: `STREAMER-RICK-STAGES.md`
- 10× reliability matrix: `RELIABILITY-RUNS.md`
- Full milestone spec: `new-app/docs/clips/STREAMER_BUILD_SPEC.md` (S4/S5 align with pass 1 signals)
