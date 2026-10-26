# Transovo product roadmap

**Last updated:** 2026-10-26 — streamer `render_job.py` syntax fix; RENDER_CLIP `download_object` guarded by worker tests; clipper E2E audit

Single source of truth for build order and status. Update the **Last updated** line at every milestone.

---

## Launch scope (ship order)

| # | Product | Status (2026-10-26) |
|---|---------|---------------------|
| **1** | **Regular clipper** — upload → process → clips → render/export (any size, resumable, survives deploys) | **IN PROGRESS (TOP PRIORITY)** |
| **2** | **Streamer** — VOD-first only (link import, auto-import after stream, uploads, chat signals, clip-that, near-live polling). **No live clipping.** | **PARTIAL** |
| **3** | **Script editor** — Descript-style transcript editor | **NOT STARTED** — `new-app/docs/clips/DESCRIPT_BUILD_SPEC.md` |
| **4** | **AI Studio** (Higgsfield-like) | **Launch: TBD** (owner decides in-launch vs immediately post-launch) |

### Launch blocker (before charging)

| Blocker | Status |
|---------|--------|
| **Login, credits, billing** | **PARTIAL** — auth/credits exist; billing + charge-ready flows must ship before paid launch |

---

## Post-launch

| # | Product | Status |
|---|---------|--------|
| **5** | **Screenwriting** (Final Draft parity) | **PAUSED / HIDDEN** — `FEATURE_SCREENWRITING=0`; code + migrations + data kept on branch `screenwriting-wip` |

**Re-enable screenwriting:** `FEATURE_SCREENWRITING=1` on web + redeploy.

**Docs:** `docs/clips/SCREENWRITING-BUILD.md`, `docs/clips/screenwriting-ui.md`, `docs/clips/screenwriting-format-flow.md`, `docs/clips/sw-browser-test-1.md`  
**Open on branch:** L07 notes column, L19 breakdown, L20 revisions/locks, inline comment anchors, real menus, live collab deploy, **D01–D41** addendum verify.

---

## 1. Regular clipper (active)

**Goal:** `PROCESS_PROJECT` → worker download by storage key → transcribe → pick → `RENDER_CLIP` → thumbnails → export.

| Layer | Notes |
|-------|--------|
| Upload | S3 multipart + Supabase TUS; `clip_upload_parts`; `/chunk` → 410; resume after reload/deploy |
| Web | `completeClipUpload` → `createClipProject` enqueues `PROCESS_PROJECT` |
| Worker | `pipeline.py` + `render_job.py` (`test_render_job_storage.py` — no `download_object` shadow) |
| **Open** | Prod `clips-worker` image may lag master — **redeploy worker when owner approves** (not during VOD job). Repo: `render_job.py` has no inner `download_object` import; `test_render_job_storage.py` + `test_download_object_shadow.py` |
| **Fixed (master)** | `streamer/render_job.py` invalid `elif` after `else` (SyntaxError broke worker import/AST checks) |

**Specs:** `docs/clips/clipping_build_plan.md`, `docs/clips/PROGRESS.md`

---

## 2. Streamer (VOD)

**Spec:** `docs/clips/STREAMER_BUILD_SPEC.md` — live clip path stays frozen.

---

## 3. Script editor

Descript-style transcript editing; spec in `new-app/docs/clips/DESCRIPT_BUILD_SPEC.md`.

---

## 4. AI Studio

**Launch: TBD.** Spec TBD when scheduled.

---

## Milestone log

| Date | Milestone |
|------|-----------|
| 2026-10-26 | Fix `streamer/render_job.py` upload branch syntax; worker shadow tests green |
| 2026-10-26 | Launch scope: clipper → Streamer VOD → script editor; AI Studio TBD; billing = launch blocker |
| 2026-10-26 | Screenwriting hidden (`FEATURE_SCREENWRITING`); `ddd3d010d` clipper `app_chunked` guard |
| 2026-10-26 | Upload direct-to-storage `64d759c87` |
