# Transovo product roadmap

**Last updated:** 2026-10-26 — owner final priority order (clipper → script editor → Streamer VOD → AI Studio); screenwriting on hold behind flag

Single source of truth for build order and status. Update the **Last updated** line at every milestone.

---

## Build order (owner final)

| # | Product | Status (2026-10-26) |
|---|---------|---------------------|
| **1** | **Regular clipper** — upload → process → clips → render/export (any size, resumable, survives deploys) | **IN PROGRESS — TOP PRIORITY, NOW** |
| **2** | **Script editor** — Descript-style transcript editor | **SPEC READY** — see `docs/clips/script-editor.md`; **do not implement until regular clipper passes prod browser test** |
| **3** | **Streamer** — VOD-first only (link import, auto-import after stream, uploads, chat signals, clip-that, near-live polling). **No live clipping.** | **PARTIAL** — after script editor spec + clipper ship |
| **4** | **AI Studio** (Higgsfield-like) | **NOT STARTED** |
| **5** | **Screenwriting** (Final Draft parity) | **ON HOLD** — `FEATURE_SCREENWRITING=0`; all code, migrations, and data kept (`screenwriting-wip`) |

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

## 2. Script editor (spec ready — gated on clipper)

Descript-style transcript editing.

| Doc | Purpose |
|-----|---------|
| **`docs/clips/script-editor.md`** | Implementation spec v1.0 (layout, EDL, tests) |
| **`docs/clips/script-editor-SOURCES.txt`** | Reference screenshot URLs (Descript help, Kapwing) |
| `new-app/docs/clips/DESCRIPT_BUILD_SPEC.md` | Earlier notes (superseded by script-editor.md for build order) |

**Gate:** Owner confirms regular clipper prod browser test → then schedule editor milestones (§D in spec).

---

## 3. Streamer (VOD)

**Spec:** `docs/clips/STREAMER_BUILD_SPEC.md`. Live clipping stays frozen.

---

## 4. AI Studio

Higgsfield-like product; spec and schedule TBD after prior priorities.

---

## 5. Screenwriting (on hold)

**Hidden in prod:** `FEATURE_SCREENWRITING` unset or `0` → no nav link; `/app/sw/*`, `/api/sw/*`, `/s/*` → 404.

**Re-enable:** `FEATURE_SCREENWRITING=1` on web + redeploy.

**Branch:** `screenwriting-wip`  
**Docs:** `docs/clips/SCREENWRITING-BUILD.md`, `docs/clips/screenwriting-ui.md`, `docs/clips/screenwriting-format-flow.md`, `docs/clips/sw-browser-test-1.md`  
**Open when resumed:** L07 notes column, L19 breakdown, L20 revisions/locks, inline comments, menus, live collab deploy, **D01–D41**

---

## Milestone log

| Date | Milestone |
|------|-----------|
| 2026-10-26 | Roadmap: clipper → script editor (wait for spec) → Streamer VOD → AI Studio → screenwriting on hold |
| 2026-10-26 | `FEATURE_SCREENWRITING` off; middleware 404; nav hidden (`a8f126228`) |
| 2026-10-26 | Clipper: direct upload `64d759c87`, `app_chunked` guard `ddd3d010d`, worker render fixes `e3264ed9a` |
| 2026-10-26 | `screenwriting-wip` @ `979106404` merged with master flag/roadmap |
