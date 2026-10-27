# Streamer — rolling-ready stage 1 (design note)

**Status:** Stage 1 pipeline is **chunked from day one** so stage 2 can process a growing Twitch archive VOD while the channel is live. **Live polling is not built yet** — this doc covers what landed in stage 1, Twitch in-progress VOD facts, and rolling-mode cost/complexity.

**Related:** `STREAMER-RICK-STAGES.md`, `STREAMER_BUILD_SPEC.md`, `STREAMER-COST-DESIGN.md`.

---

## Goals (Rick)

| Phase | Behavior |
|-------|----------|
| **Stage 1 (now)** | Import **audio_only**; analyze in **~10–15 min chunks** (config: `STREAMER_CHUNK_MIN`, default 15); each chunk **transcribed + signal-scored** independently with **VOD-relative timestamps**; merge transcript + signals; **shortlist + LLM rank**; render fetches **video segments only** at the end. |
| **Stage 2 (later)** | While live: poll growing archive playlist, pull **new audio** every ~10–15 min, run chunk pipeline incrementally; on `stream.offline` finish last chunk + shortlist + video-watch + renders → clips **~5–10 min** after stream end. |

**Time base:** All analyze/rank timestamps are **milliseconds from VOD t=0**. Twitch `audio_only` and video renditions share **the same segment timeline** on the archive playlist (same `#EXTINF` positions). Chunk objects store `vodStartMs` / `vodEndMs`; transcript words use absolute VOD seconds after merge.

---

## Stage 1 implementation

### Chunk plan

- `plan_chunks(duration_ms, chunk_ms, overlap_ms)` in `chunking.py`.
- Env: `STREAMER_CHUNK_MIN` (minutes, default **15**), `STREAMER_CHUNK_OVERLAP_S` (default **30**). For rolling, Rick suggested **10–15 min** — set `STREAMER_CHUNK_MIN=10` or `12` without code changes.
- Persisted on VOD: `state.chunkPlan` `{ v, chunkMs, overlapMs, ranges[] }`.
- Log: `[clipper:stream] analyze_chunk_plan vodId=… chunks=N`.

### Per-chunk artifacts (object storage)

Under `ws/{workspace}/streams/{vodId}/chunks/{index}.*`:

| Object | Content |
|--------|---------|
| `{i}.opus` | Audio slice (VOD-relative cut from full `audio.opus`) |
| `{i}.words.json` | Transcript words (absolute VOD time, from GPU/Modal with `offset_ms`) |
| `{i}.signals.json` | Per-chunk 1 Hz curves: `audio`, `transcript`, `speakerChange` + `vodStartMs` / `vodEndMs` |

Checkpoint: `state.chunks[i].wordsKey`, `signalsKey`, `startMs`, `endMs`.

### Signal merge → rank

- `chunk_signals.score_chunk_signals()` — scores one chunk (chunk-local 1 Hz series).
- `merge_chunk_signal_curves()` — stitches to full-VOD length; **overlap windows use max()** (same rule as transcript merge at overlap midpoints).
- `rank_moments(..., vod_signal_curves=…)` — uses merged curves instead of re-scanning full audio for those three signals. Chat, viewer clips, markers still computed on the full VOD once at the end (stage 2 can incrementally extend these).

`signals.json` on the VOD includes `chunkedSignals: true` and `chunkCount`.

### Render alignment

Before reframing, `align_segment_ms()` cross-correlates **~5 s** of PCM from the downloaded **video segment** against the canonical **`audio.opus`** near the nominal cut. Corrects yt-dlp section drift; logs when **|drift| > 200 ms**:

`[clipper:stream] segment_align_drift vodId=… clipId=… nominalStartMs=… trueStartMs=… driftMs=… peak=…`

### Import errors (muted / VOD disabled)

`import_errors.py` + `ytdlp.metadata()`:

- **Muted / no usable audio** — clear message to upload a local recording.
- **VOD storage disabled** — channel cannot import from link; upload OBS file.
- **Kick live** — replay-only message (no live capture).
- **Twitch live (paste path today)** — still rejects with “paste VOD after stream ends” unless `allow_twitch_growing_vod=True` (reserved for stage 2).

---

## Twitch in-progress archive VOD (research)

**Conclusion: yes — an archive VOD is generally available while the stream is still live**, suitable for stage 2 polling of **audio_only** segments, with caveats.

| Source | Finding |
|--------|---------|
| **Twitch / Helix** | When “Store past broadcasts” is enabled, the broadcast is associated with an **archive** video id for that session. Duration grows until the stream ends. |
| **HLS** | Archive VOD uses the **video** usher URL (not the live channel playlist). Streamlink documents that for a VOD **still being recorded**, playback can **start from the beginning** of the recording (`force_restart` on video HLS). |
| **Growing playlist (2025)** | Community tools report Twitch VOD playlists behaving as **EVENT**-style growing manifests (playlist extends as new segments land), which enables “download until offline” rather than a static frozen duration. yt-dlp often surfaces this as `is_live` / growing metadata on the **VOD URL**. |
| **Caveats** | VOD disabled / excluded categories / unpublished VODs → import fails (handled). **Subscriber-only** and **muted** segments still apply. **Do not** use the **live** channel HLS alone for full timeline — use the **archive VOD id/URL**. Ads on live edge do not apply the same way on VOD chunks. |

**Stage 2 hook already stubbed:** `ytdlp.metadata(..., allow_twitch_growing_vod=True)` sets `growing_vod: true` instead of raising `LIVE_MSG` for Twitch.

**Recommended verification before stage 2 prod:** For 2–3 live test streams, log Helix `Get Videos` (`type=archive`) every minute + yt-dlp `-J` duration/`is_live` on the VOD URL; confirm new `audio_only` segments appear every ~10 s–2 min.

---

## Stage 2 rolling mode — extra complexity (estimate)

| Area | Work | Relative effort |
|------|------|-----------------|
| **Web / autopull** | On `stream.online`, create project; poll VOD playlist + Helix; enqueue **incremental** `STREAM_ANALYZE_CHUNK` (or extend analyze job with `chunkIndex` only). | **M** |
| **Import** | Partial `audio_only` append to `audio.opus` or per-chunk-only storage; `--download-sections` / HLS range fetch; `allow_twitch_growing_vod`. | **M** |
| **Chat** | Incremental chat ingest (Twitch) vs today’s post-hoc bulk; align timestamps to VOD. | **M–L** |
| **Rank** | Re-run fusion/LLM on **new** transcript tail or debounced every N chunks; avoid re-LLM entire 8 h stream each tick. | **M** |
| **Render** | Queue renders only after `stream.offline` (+ optional video-watch pass). | **S** |
| **State / idempotency** | `chunkPlan.ranges` grows with VOD duration; heartbeat; cap metering still once per VOD. | **S** |
| **Kick** | No growing VOD — **90 min replay poll** after offline (separate Rick track). | **S** |

**Total engineering (rough):** ~**3–5 engineer-weeks** after stage 1 reliability gate, assuming no video-watch pass in v1 rolling.

---

## Stage 2 rolling mode — cost estimate (per 4 h stream)

Assumptions: 15 min chunks → **~16 analyze chunks**; same Modal/Groq transcribe as today; rank/LLM once at end (+ optional light re-rank per chunk).

| Cost driver | Post-stream (today) | Rolling (incremental) | Delta |
|-------------|---------------------|------------------------|-------|
| **Transcribe** | ~4 h audio once | ~4 h audio once (spread over stream) | **~0%** GPU minutes |
| **Signal + ASR per chunk** | Same total CPU/ffmpeg | Same | **~0%** |
| **LLM rank** | 1× full shortlist | 1× final + optional partial reranks | **+0–15%** tokens if debounced poorly |
| **Object storage** | Chunks + audio | Same + slightly more LIST/PUT churn | **+5%** |
| **Worker occupancy** | Burst after VOD | Long idle poll + chunk bursts | **+10–20%** wall-clock machine time** (pollers) |
| **Helix / yt-dlp** | Low | Poll every 1–2 min × stream hours | **negligible** $ |

**User-visible win:** Clips **5–10 min after offline** vs **analyze_time + render** after full VOD import (often **20–60+ min** for long streams).

---

## Out of scope in this change

- Live playlist polling, webhooks driving chunk jobs, Kick 90 m replay autopull.
- **Video-watch** pass on top ~25–30 shortlist candidates.
- Changing default `STREAMER_CHUNK_MIN` from 15 (use env for 10–15).

---

## Logging checklist

- `[clipper:stream] analyze_chunk_plan`
- `[clipper:stream] segment_align_drift` (|drift| > 200 ms)
- Existing transcribe / modal / collab logs unchanged
