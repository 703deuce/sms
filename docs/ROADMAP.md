# Transovo product roadmap

**Last updated:** 2026-10-27 — Rick: clipper → script editor → AI Studio → **STOP**; then clipper fine-tuning; screenwriting on hold behind `FEATURE_SCREENWRITING`

Single source of truth for build order and status. Update the **Last updated** line at every milestone.

---

## Build order (owner final)

| # | Product | Status (2026-10-27) |
|---|---------|---------------------|
| **1** | **Regular clipper** — upload → process → clips → render/export (any size, resumable, survives deploys) | **IN PROGRESS** |
| **2** | **Script editor** — Descript-style transcript editor | **SPEC READY** — `docs/clips/SCRIPT-EDITOR-BUILD.md` (+ `docs/clips/script-editor.md`) |
| **3** | **AI Studio** (Higgsfield-like) | **NOT STARTED** |
| — | **STOP** after **1–3** ship | No screenwriting until re-enabled |
| — | **Screenwriting** (Final Draft parity) | **ON HOLD** — `FEATURE_SCREENWRITING=0`; code/migrations/data kept (`screenwriting-wip`) |

**Then (after 1–3):** [Clipper fine-tuning pass](#clipper-fine-tuning-pass-after-13) (reframe/layout quality across many videos — not a new product).

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
| **RENDER_CLIP / `download_object`** | No inner re-import in `run_render_clip_job` — `test_render_job_storage.py`, `test_download_object_shadow.py` |
| **Worker syntax** | Fixed `streamer/render_job.py` upload `elif` branch (`e3264ed9a`) |
| **Prod** | Redeploy `clips-worker` when owner approves (not during active VOD jobs) |

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

## 3. AI Studio

Higgsfield-like product; spec and schedule after clipper + script editor ship.

---

## Clipper fine-tuning pass (after 1–3)

Quality and layout intelligence for the **regular clipper** (and shared reframe stack), informed by many real uploads — not tuned to a single test video.

| Item | Intent |
|------|--------|
| **(a) Face + active speaker** | Generalize face tracking and active-speaker reframing across diverse footage; avoid overfitting to one golden test clip. |
| **(b) Single-person + corner webcam** | Detect one-person / screen-share + small webcam inset; do not treat as multi-speaker drama; prefer full-frame or fit/blur when appropriate. |
| **(c) Top/bottom split** | Test and auto-select content + face split layout when the scene fits (vs speaker-follow or fit-only). |
| **(d) Variety across clips** | Vary layout treatment and caption/style choices across clips in one project instead of one template for every output. |

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
| 2026-10-27 | Roadmap: clipper → script editor (SCRIPT-EDITOR-BUILD.md) → AI Studio → STOP; fine-tuning pass (a–d); Streamer VOD resumable-download stays in backlog |
| 2026-10-26 | Roadmap: clipper → script editor → Streamer VOD → AI Studio → screenwriting on hold |
| 2026-10-26 | `FEATURE_SCREENWRITING` off; middleware 404; nav hidden (`a8f126228`) |
| 2026-10-26 | Clipper: direct upload `64d759c87`, `app_chunked` guard `ddd3d010d`, worker render fixes `e3264ed9a` |
| 2026-10-26 | `screenwriting-wip` @ `979106404` merged with master flag/roadmap |
