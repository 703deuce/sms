# Streamer — Rick stages (after regular clipper gaps)

**Status:** Stage 1 only until **reliability acceptance** (below). **No Stage 2 auto-pull** until that gate passes.  
**Regular clipper:** REGULAR-CLIPPER-GAPS complete on `master`.  
**Billing:** not in scope — record **VOD hours processed per workspace per month** (`StreamUsage.sourceSeconds`, idempotent `meter_vod_once`).  
**Logging:** **`[clipper:stream]`** on every step; include `workspaceId`, `projectId`, `vodId`, `jobId`, `stage` — never tokens or OAuth secrets.  
**Two-strike rule** for production fixes.

Reference: `new-app/docs/clips/STREAMER_BUILD_SPEC.md` (S0–S15). This doc is Rick’s **reliability + storage** contract.  
**Transcription cost (full-VOD Groq + Luna rerank; Deepgram captions on finals):** `STREAMER-COST-DESIGN.md`.

---

## Design principles (Rick addendum)

### Storage — never hold a full VOD on the worker

| Phase | What we fetch | Tooling | Disk budget |
|-------|----------------|---------|-------------|
| **Import** | **Audio only** (`bestaudio` / opus) for metadata duration + cap check | `ytdlp.download_audio` (`-f bestaudio`), optional `--download-sections` for user range | Scratch per `vodId`; yt-dlp `--continue` via `import_cache.py` |
| **Analyze** | Chunked transcribe on **uploaded audio** in object storage | `analyze_job.py`, chunk keys in `state.chunks` | No full video |
| **Pick moments** | Signals + LLM on transcript | `rank_moments` | No video |
| **Render** | **Video only for chosen windows** (clip ± pad) | `segments.download_segment` (`--download-sections`) or `cut_local_segment` for user uploads | One segment MP4 at a time; upload `sourceSegKey`; delete local seg after upload |

**Rules**

- **No multi-GB files on worker disk** — no “download entire VOD mp4 then upload to S3” for paste Twitch/Kick **vod/highlight** paths.
- **Temp hygiene:** `cleanup_vod_import_dir` on import success; `TemporaryDirectory` / per-job `td_path` removed on success **and** failure; `STREAM_CLEANUP` deletes audio + chunks from bucket after clips READY.
- **Resume / retry:** checkpoint `StreamVod.state` (`audioKey`, `chunks`, `segmentKeys` or per-clip `sourceSegKey`); re-run skips finished steps; **per-segment** render retries re-fetch only that section (harden: persist segment attempt in state).

**Current code vs target**

| Area | Today | Stage 1 change |
|------|--------|----------------|
| Long VOD (> `STREAMER_FULL_DOWNLOAD_MAX_MIN`, default 20 min) | Audio-only import ✓ | Keep; add `[clipper:stream]` + progress |
| Short VOD / highlight paste | **Full `download_video`** → S3 `localUploadKey` ✗ | **Remove short-path full download** — always audio-first for `vod`/`highlight`; only `clip` kind may fetch a single short section |
| Render | `download_segment` per clip when no local master ✓ | Add per-segment retry + state; never re-download full VOD |
| User file upload | Master stays in bucket (user already uploaded) | Audio extract + optional analysis proxy only (already partially true) |

### Reliability

- Idempotent job handlers; heartbeat on long jobs (`Heartbeat`, `lockedAt` refresh).
- Worker reaper retry ≠ new user-facing “attempt” (same `projectId` / `vodId`).
- Failures: terminal payload + `StreamVod.error`; scratch swept (`sweep_stale_failed_import_dirs`).

### Usage metering (no billing)

- **Record once per VOD:** `meter_vod_once` in `analyze_job.py` → `stream_usage.sourceSeconds` + `vodCount` for calendar month (UTC).
- **Pre-check:** `check_cap` / `assertStreamCap` before import (cap from `workspace_limits.limits.streamer.monthlyHours`; enforcement optional until billing).
- **UI:** `GET /api/streamer/usage` — show hours used this month (no Stripe).

### Clip retention (finished outputs)

| Tier | Retention | Config (planned) |
|------|-----------|------------------|
| Monthly workspace | **14 days** | `STREAMER_CLIP_RETENTION_DAYS_MONTHLY` (default 14) |
| Annual workspace | **90 days** | `STREAMER_CLIP_RETENTION_DAYS_ANNUAL` (default 90) |

**Job (not built):** internal maintenance cron — find clip projects / stream VODs older than tier; delete preview/poster/segment/render keys; set `deletedAt`. **Distinct** from **source** cleanup (audio/chunks right after processing).

Workspace tier flag: `workspace_limits.limits.streamer.retentionTier` = `monthly` | `annual` (no billing linkage yet).

---

## Stage 1 — Paste Twitch/Kick VOD

Same user story as before: paste link, attestation, progress/errors, ~**10 h** analysed cap (align env from 12 → 10 when Rick confirms), source deleted after READY.

**Implementation order (storage-first)**

1. **Eliminate full VOD download** on paste path (`import_job.py` short branch).
2. **`[clipper:stream]`** across `import_job`, `analyze_job`, `render_job`, `cleanup_job`, `imports.ts`.
3. **Per-segment retry** + checkpoint in `render_job` / `state.segmentKeys`.
4. **Cleanup on READY** — enqueue `STREAM_CLEANUP` immediately; verify keys gone.
5. **Retention job** — config + maintenance route (clips only).
6. **Progress UX** — audio %, chunk `i/n`, segment `clipId` on project page.

---

## Reliability acceptance (blocks Stage 2 auto-pull)

**Gate (Rick, 2026-10-27):** **One** real Twitch **or** Kick **VOD** import (**2–6 h**, paste path, production or staging with worker deploy) completes **end-to-end** with no silent failure.

| # | Requirement |
|---|-------------|
| R1 | **0 failures** — no terminal `FAILED` jobs; project reaches `READY` with ≥1 ranked clip. |
| R2 | Clips **render** and at least **one** clip **exports** successfully (download). |
| R3 | Public VOD only — no sub-only / login-gated sources. |
| R4 | After run: no full-VOD object in bucket; `sourceDeletedAt` set; analyse chunks cleaned; clips playable. |
| R5 | `StreamUsage` += analysed hours once per VOD. |
| R6 | Failures stay **user-visible** — plain-English `StreamVod.error` / job payload (muted VOD, VOD disabled, etc.); `[clipper:stream]` logs with `vodId` / `jobId`. |

**Evidence pack** — paste into `docs/clips/streamer/RELIABILITY-RUNS.md`:

```text
run=01 platform=twitch duration_h=4.2
projectId=proj_… vodId=svod_…
jobs: STREAM_IMPORT=job_… STREAM_ANALYZE=job_… STREAM_RENDER=job_… STREAM_CLEANUP=job_…
result=READY clips=12 exported=1 sourceDeletedAt=set chunks_cleaned=yes
logs: grep '[clipper:stream]' vodId=svod_… (attach redacted excerpt)
```

**Optional torture (not required for sign-off):** kill worker once mid-import — must resume to READY without a new project.

**Stage 1 sign-off** = one clean run + evidence. **Then** Stage 2.

---

## Stage 2 — Auto-pull (after acceptance)

**Twitch:** EventSub **`stream.offline`** / **`stream.online`**; rolling processing on the **growing archive VOD** while live (chunked analyze from stage 1).  
**Kick:** poll for **replay** after stream ends (up to **~90 min**).  
**Shared:** same audio-first + segment render pipeline; **error handling unchanged** — bad streams must not fail silently.  
OAuth, manual pull 14d, notify when ready — as in build spec.

---

## Worker deploy

Touches `worker/clips_worker/streamer/**` → commit **`WORKER DEPLOY`**. Run the **one-VOD** acceptance only after deploy.

---

## Decision log

| Date | Decision |
|------|----------|
| 2026-10-27 | Gaps done; Streamer Stage 1 next |
| 2026-10-27 | Rick addendum: **no full VOD download**; segment video only; retention 14/90d; usage hours/month |
| 2026-10-27 | Rick: **one** clean **2–6h** VOD (rank + render + export + cleanup) replaces **10×** matrix before auto-pull |
| 2026-10-27 | **Two-pass transcribe:** cheap full-audio + chat pass → top ~36×60–120s windows → Deepgram only those; ~45–60 min / 4h VOD; `STREAMER_TRANSCRIBE_SCOPE=full` fallback |
| — | Confirm **10 h** vs code default **12 h** |
