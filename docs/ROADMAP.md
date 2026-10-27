# Transovo product roadmap

**Last updated:** 2026-10-27 — Rick: clipper → **script editor milestones** → **STOP** → [polish / fine-tuning pass](#clipper-fine-tuning-pass-after-script-editor); **AI Studio ON HOLD** (not in build queue); screenwriting on hold behind `FEATURE_SCREENWRITING`  
**Prod clipper (2026-10-27):** Deepgram+Whisper fallback, B2 worker source cache, stage-aware ETA, 1080p export; script editor shipping on `305f73fae`+ train.

Single source of truth for build order and status. Update the **Last updated** line at every milestone.

---

## Build order (owner final)

| # | Product | Status (2026-10-27) |
|---|---------|---------------------|
| **1** | **Regular clipper** — upload → process → clips → render/export (any size, resumable, survives deploys) | **IN PROGRESS** — core pipeline live on prod (see below) |
| **2** | **Script editor** — Descript-style transcript editor | **IN PROGRESS** — M1–M2 shipped on prod; M3+ per `docs/clips/SCRIPT-EDITOR-BUILD.md` |
| — | **STOP** after script editor milestones ship | No new product work until polish pass (below) |
| — | **AI Studio** (Higgsfield-like) | **ON HOLD** — not being added yet; no schedule; spec TBD when owner re-enables |
| — | **Screenwriting** (Final Draft parity) | **ON HOLD** — `FEATURE_SCREENWRITING=0`; code/migrations/data kept (`screenwriting-wip`) |

**Then (after script editor milestones):** [Clipper fine-tuning / polish pass](#clipper-fine-tuning-pass-after-script-editor) across clipper, Streamer, and script editor — not a new product.

### Before charging (launch blocker)

| Blocker | Status |
|---------|--------|
| **Login, credits, billing** | **PARTIAL** — auth/credits exist; billing + charge-ready flows required before paid launch |

---

## 1. Regular clipper (active — NOW)

**Goal:** End-to-end: direct-to-storage upload → `completeClipUpload` → `createClipProject` / `PROCESS_PROJECT` → worker download by storage key → transcribe → pick clips → preview → `RENDER_CLIP` → thumbnails → export.

| Layer | Notes |
|-------|--------|
| Upload | S3 multipart + Supabase TUS; `clip_upload_parts`; resume; `/chunk` → 410; legacy `app_chunked` rejected on client |
| Web | `lib/clips/upload.ts`, `lib/server/clips/uploads.ts` |
| Worker | `pipeline.py`, `clips_worker/render_job.py` |
| **ASR** | **LIVE** — Deepgram primary, local Whisper fallback (`eeffb66c7`+) |
| **B2 egress** | **LIVE** — on-disk source cache `2f9e01faf`, `CLIPS_SOURCE_CACHE_MAX_GB`, shared mount both worker lanes |
| **ETA** | **LIVE** — stage-aware upload ETA + poll clamp (`db41e7a6b`) |
| **Export** | **LIVE** — 1080p export (`3083d08d3`) |
| **Retry/resume** | Re-queue skips transcribe when `transcriptWords` on project; picker pass1 re-runs (not persisted); source re-download uses cache |
| **RENDER_CLIP / `download_object`** | No inner re-import in `run_render_clip_job` — `test_render_job_storage.py`, `test_download_object_shadow.py` |
| **Worker syntax** | Fixed `streamer/render_job.py` upload `elif` branch (`e3264ed9a`) |
| **Prod workers** | `clips-worker` + `clips-worker-stream` @ `db41e7a6b` worker tree (manager verified Oct 2026) |

**Specs:** `docs/clips/clipping_build_plan.md`, `docs/clips/PROGRESS.md`

---

## 2. Script editor (next after clipper)

Descript-style transcript editing.

| Doc | Purpose |
|-----|---------|
| **`docs/clips/SCRIPT-EDITOR-BUILD.md`** | **Primary build plan** — milestones (§D), Prisma draft, APIs, component tree, EDL/render bridge |
| **`docs/clips/script-editor.md`** | Implementation spec v1.0 (layout, EDL, tests) |
| **`docs/clips/script-editor-SOURCES.txt`** | Reference screenshot URLs (Descript help, Kapwing) |
| `new-app/docs/clips/DESCRIPT_BUILD_SPEC.md` | Earlier notes (superseded by SCRIPT-EDITOR-BUILD.md for order) |

**Gate:** Regular clipper passes prod browser test → schedule editor milestones per SCRIPT-EDITOR-BUILD.md.

---

## 3. AI Studio (on hold)

Higgsfield-like product. **Owner (2026-10-27): not in the build queue** — do not start implementation or scheduling. When re-enabled, spec and order will be decided separately (after polish pass unless owner changes plan).

---

## Clipper fine-tuning pass (after script editor)

Quality and layout intelligence for the **regular clipper** (and shared reframe stack), informed by many real uploads — not tuned to a single test video.

| Item | Intent |
|------|--------|
| **(a) Face + active speaker** | Generalize face tracking and active-speaker reframing across diverse footage; avoid overfitting to one golden test clip. |
| **(b) Single-person + corner webcam** | Single-person streams with a small corner webcam box must **not** be treated as several people; consider a plain full-frame clip when appropriate. |
| **(c) Top/bottom split** | Test and **auto-choose** top/bottom split layout when the scene fits (vs speaker-follow or fit-only). |
| **(d) Variety across clips** | Vary layout treatment and caption/style choices across clips in one project instead of one template for every output. |
| **(e) Wide two-shot crop** | Fix reframing that crops a wide two-shot and cuts one person in half. |
| **(f) ETA calibration** | Further tune stage-aware ETA as more prod timings land (initial calibration shipped Oct 2026). |
| **(g) Parallel render** | Further tune `CLIPS_RENDER_CONCURRENCY` / ffmpeg threads per host (initial pool shipped Oct 2026). |
| **(h) Speaker-follow calmness** | **Owner feedback (proj_89c551443cb34a48a034a2260e9eeeca, 25 min interview):** 2/4 clips framed the wrong talker; one clip panned to the mic ~2 s during a pause before landing on the guest. **Goal:** stay on the current person; switch **slightly late** (not early), only when someone is clearly talking. **Planned (`v3/speakercrop_v2.py`):** `LEAD` 0.4 → 0 or small lag; `MIN_SEG` 0.8 → ~2–3 s; higher `HYST` + require sustained speech (≥~1 s) from new speaker before cut; **Deepgram word-level diarization (`spk`)** as primary who-is-talking signal (Resemblyzer clusters demoted); lips only to map speaker→face; **hold last crop** when face detection drops (pauses, head turns); ignore pauses and backchannels (“yeah”, “mm-hm”) as switch triggers; **regression test** on this interview fixture. |
| **(i) Multi-person speaker follow (3–5 people)** | **`v3/speakercrop_v2.py` today:** hardcoded 2 slots (`pos=[0.3W,0.7W]`, top-2 faces, `k in 0..1`). **Plan:** track **N** faces with stable IDs (position/IoU tracker plus face embedding re-ID across cuts and head turns); take speaker count and per-word speaker labels from **Deepgram diarization**; map each Deepgram speaker to a face ID by correlating lip motion with that speaker's word times across the clip; crop follows the active speaker under the same calmness rules as **(h)**; when 2+ talk at once, or the speaker is unknown, use a wide or fit-blur group shot (or a 2-up split for two active talkers); off-screen speakers hold the last on-screen subject; add **tests** with a synthetic 3–4 face track. |

**Scope:** **Post–script-editor polish** — same pass across **clipper, Streamer, and script editor** (and shared reframe stack). Do not schedule until script editor milestones are done and owner says GO on fine-tuning.

---

## Streamer (VOD) — backlog (not in 1–3 sequence)

**Spec:** `docs/clips/STREAMER_BUILD_SPEC.md`. **No live clipping.**

| Open item | Notes |
|-----------|--------|
| **VOD resumable-download fix** | Long imports must survive worker restart/reap: checkpointed download + resume (see spec §0.2.4 idempotent, resumable jobs; `StreamVod.state`). |

Further S2–S15 milestones: `docs/clips/PROGRESS.md`.

---

## Screenwriting (on hold)

**Hidden in prod:** `FEATURE_SCREENWRITING` unset or `0` → no nav link; `/app/sw/*`, `/api/sw/*`, `/s/*` → 404.

**Re-enable:** `FEATURE_SCREENWRITING=1` on web + redeploy.

**Branch:** `screenwriting-wip`  
**Docs:** `docs/clips/SCREENWRITING-BUILD.md`, `docs/clips/screenwriting-ui.md`, `docs/clips/screenwriting-format-flow.md`, `docs/clips/sw-browser-test-1.md`  
**Open when resumed:** L07 notes column, L19 breakdown, L20 revisions/locks, inline comments, menus, live collab deploy, **D01–D41**

---

## Milestone log

| Date | Milestone |
|------|-----------|
| 2026-10-27 | Prod: Deepgram+Whisper, B2 source cache, ETA fix, 1080p export live (`db41e7a6b`); retry/resume transcript-aware (pending push) |
| 2026-10-27 | Owner: AI Studio **ON HOLD**; after script editor milestones → STOP → polish pass (not AI Studio) |
| 2026-10-27 | Roadmap: clipper → script editor (SCRIPT-EDITOR-BUILD.md) → STOP → fine-tuning; Streamer VOD resumable-download stays in backlog |
| 2026-10-26 | Roadmap: clipper → script editor → Streamer VOD → AI Studio → screenwriting on hold |
| 2026-10-26 | `FEATURE_SCREENWRITING` off; middleware 404; nav hidden (`a8f126228`) |
| 2026-10-26 | Clipper: direct upload `64d759c87`, `app_chunked` guard `ddd3d010d`, worker render fixes `e3264ed9a` |
| 2026-10-26 | `screenwriting-wip` @ `979106404` merged with master flag/roadmap |
