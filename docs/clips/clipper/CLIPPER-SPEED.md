# Regular clipper — speed baseline and optimizations

Scope: **talking-mode** `PROCESS_PROJECT` (not Streamer, not XML/4K). Timings use worker tags `[clipper:speed]` and DB wall clocks.

## Phases (typical 1–10 min upload)

| Phase | What it measures | Log / source |
| --- | --- | --- |
| Upload | Client → storage (out of worker) | App upload metrics (not in worker) |
| Source download | S3/R2 fetch once per job | `[clipper:speed] phase=source_download_ms` in `main.py` |
| Transcribe | ASR when no cached words | `[clipper:speed] phase=transcribe_ms` |
| Pick | Pass1 + pass2 + finalize | `[clipper:speed] phase=pick_ms` |
| First clip card | First row in `clips` + progress `clip_ready` | `[clipper:speed] phase=first_clip_card_ms` (pipeline monotonic from job start) |
| Full job | `clip_jobs.createdAt` → `finishedAt` | `scripts/clipper-prod-speed-report.ts` |

### Prod medians (1–10 min span, READY projects)

Run on a host with `DATABASE_URL`:

```bash
DATABASE_URL=... npx tsx scripts/clipper-prod-speed-report.ts --limit=80
```

**Cloud agent note (2026-10-27):** `DATABASE_URL` and Coolify SSH were unavailable in the measurement environment. Re-run the script above on production/staging and paste medians here. Until then, use worker logs from recent jobs for per-phase `*_ms` lines.

| Metric | Before (baseline) | After (this change) |
| --- | --- | --- |
| Median wall job (1–10 min) | _run script_ | _run script_ |
| Median first clip card | _run script_ | _run script_ (expect lower: headstart + parallel render) |
| Re-download source in pipeline | Yes (second `download_object` when `local_src` omitted) | **No** — `main.py` passes `local_src` / `local_audio_wav` |
| Render concurrency order | Index order | **Score order** (`index_order` in `bounded_pool`) |
| Render vs pick | Sequential | **Headstart** top pass1 pick during pass2 LLM |

## Code changes (speed)

1. **Single local source** — `process_job` downloads once; `run_m4_pipeline(..., local_src=, local_audio_wav=)` skips pipeline re-download and re-extract.
2. **Headstart render** — `pick_talking_clips(..., on_headstart_picks=)` finalizes top heuristic picks after pass1 and starts rendering the best span on a background thread while pass2 runs.
3. **Parallel renders** — talking mode uses `run_bounded_indexed_pool` with `clips_render_concurrency()` and score-sorted `index_order`; dedupes headstart spans so clips are not rendered twice.
4. **Tagged logs** — `source_download_ms`, `transcribe_ms`, `pick_ms`, `first_clip_card_ms`, `headstart_render_begin`.

## Pick quality (boundary audit)

Audit last ~30 READY projects:

```bash
DATABASE_URL=... npx tsx scripts/clipper-prod-boundary-audit.ts --limit=30
```

**Snap improvements** (`snap_bounds.py`):

- Inter-sentence gap picks anchor the **next** sentence (no rewind to prior sentence + dead air).
- Trailing gap before a new sentence snaps end to previous sentence-final word.
- Leading dead air: no negative pad into silence before the first substantive word.

Regression: `cd worker && python3 -m pytest tests/test_snap_bounds.py`.

## Deploy

Worker changes require **WORKER DEPLOY** (clips CPU worker image). App-only script/doc changes do not.
