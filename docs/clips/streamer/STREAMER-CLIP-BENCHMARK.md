# Stream clip ranking benchmark

**Goal:** Viewer-made Twitch clips are ground truth; ranking must not ship if recall drops.

## Eval script

```bash
PYTHONPATH=worker python3 scripts/stream-clip-eval.py
PYTHONPATH=worker python3 scripts/stream-clip-eval.py --fixture worker/fixtures/stream_clip_eval_vods.json
```

Reports `recallAt10` / `recallAt20` with **overlap ≥ 50%** vs Helix viewer clips.

### Latest synthetic fixture (CI / local)

| VOD id | Viewer clips | recall@10 | recall@20 |
|--------|--------------|-----------|-----------|
| synthetic_short | 2 | Run script for current numbers |

Add real benchmark VOD rows to `worker/fixtures/stream_clip_eval_vods.json` (Twitch `video_id`, `viewerClips` from Helix) before changing fusion weights in prod.

## Ranking pipeline (stage 1 paste VOD)

1. **Signals:** Helix Get Clips (viewer), chat rate + laugh emotes (LUL/KEKW/…/W/L), `!clip`, streamer clip-call phrases, chapters/markers, audio loudness, transcript hype, speaker-change density (diarized words).
2. **Candidates:** ≥50 wide peaks → **gpt-6-luna** rerank (Gemini flash-lite fallback) with transcript context → dedupe → **primary 10–20** + **more moments** tier; full list in `rank_candidates.json`.
3. **Boundaries:** `snap_bounds.py` on each pick (setup → punchline sentences).
4. **Feedback:** `ClipEvent` + `stream_channels.settings.feedbackFeatures` (thumbs down, download, export).

## Cheap stack (target $/4h VOD)

| Step | Approach |
|------|----------|
| Import | Audio-only HLS / `bestaudio` first (no full VOD MP4 on worker) |
| Transcribe | Modal **large-v3-turbo**, batched warm containers |
| Diarization | Only on collab / top windows (not full solo path) |
| Captions on finals | Whisper word timings; **Deepgram fallback** only |
| Render | **Video segments** only for chosen primary-tier clips |

**Cost estimate:** extrapolate from `[clipper:stream] transcribe_vod` GPU seconds × `MODAL_L4_USD_PER_GPU_S` + Deepgram caption minutes on rendered clips only. See `STREAMER-MODAL-TRANSCRIBE-BENCHMARK.md` for a ~4h sample run; typical target **&lt;$2–4 / 4h solo** audio-first (verify with prod logs after Modal benchmark).
