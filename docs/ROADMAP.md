# Transovo product roadmap

**Last updated:** 2026-10-26 (owner reprioritized: clipper first; screenwriting hidden behind `FEATURE_SCREENWRITING=0`)

Single source of truth for build order and status. Update the **Last updated** line at every milestone.

---

## Build order (current)

| Priority | Product | Status (2026-10-26) |
|----------|---------|---------------------|
| **1** | **Regular clipper** (upload → process → clips → render/export) | **IN PROGRESS** — direct-to-storage uploads on web (`64d759c87+`); retest large uploads; worker RENDER_CLIP regression test in repo |
| **2** | **Streamer** (VOD-first: link import, auto-import, chat signals, clip-that, near-live polling) | **PARTIAL** — live clipping frozen |
| **3** | **AI Studio** (Higgsfield-like) | **NOT STARTED** |
| **4** | **Descript-style transcript editor** | **NOT STARTED** — see `new-app/docs/clips/DESCRIPT_BUILD_SPEC.md` |
| **5** | **Screenwriting** (Final Draft parity) | **PAUSED / HIDDEN** — `FEATURE_SCREENWRITING=0`; branch `screenwriting-wip` |
| **6** | **Login, credits, billing** | **PARTIAL** — existing auth/credits; polish TBD |

---

## 1. Regular clipper (TOP PRIORITY)

**Goal:** Any-size upload, resumable, survives web deploys; `PROCESS_PROJECT` → worker download by storage key → transcribe → pick clips → `RENDER_CLIP` → thumbnails → export.

| Layer | Notes |
|-------|--------|
| Upload | S3 multipart + Supabase TUS; parts in `clip_upload_parts`; `/chunk` → 410; `upload-part-bookkeeping` tests |
| Web complete | `completeClipUpload` → `createClipProject` enqueues `PROCESS_PROJECT` |
| Worker | `pipeline.py` download; `render_job.py` export (no inner `download_object` re-import — `test_render_job_storage.py`) |
| **Open** | Prod worker image may lag master (RENDER_CLIP `download_object` UnboundLocalError reported ~13:52 UTC 2026-10-26) — **schedule worker redeploy** after VOD job; do not restart workers without owner OK |

**Specs:** `docs/clips/clipping_build_plan.md`, `docs/clips/PROGRESS.md`

---

## 2. Streamer

VOD import, analyze, montage, stream render; near-live polling. True live clip path frozen.

**Spec:** `docs/clips/STREAMER_BUILD_SPEC.md`

---

## 3–4. AI Studio & Descript editor

Not active. Specs under `docs/clips/` when scheduled.

---

## 5. Screenwriting (LAST — feature flag)

**Enable:** set `FEATURE_SCREENWRITING=1` on web app and redeploy (nav + `/app/sw/*`, `/api/sw/*`, `/s/*`).

**Tracker:** `docs/clips/SCREENWRITING-BUILD.md`  
**UI spec:** `docs/clips/screenwriting-ui.md` (22 look checks)  
**Format / flow:** `docs/clips/screenwriting-format-flow.md` (28 `[U]` tests)  
**Browser tracker:** `docs/clips/sw-browser-test-1.md`  
**WIP branch:** `screenwriting-wip` @ `191a790b9` (import modes, FD chrome, 28 format tests, ScriptNotes column WIP, collab service code — deploy not finished)

### Done (on `screenwriting-wip`, not prod-flagged)

- P0 editor: Yjs undo, collab banner honesty, SmartType, PDF, normalize doc, read aloud
- P1 #8–#14: import Replace/Append/New + PRE_IMPORT; beat board; cards; versions diff; FDX title page; fountain clusters; Ctrl+1–7; fast open
- 28 format-flow unit tests; breakdown/revisions/menu/notes column **partial** on WIP

### Open (before prod ship)

| Area | Item |
|------|------|
| L07 | Dedicated right ScriptNotes column + margin markers (WIP on branch) |
| L19 | Breakdown hotkey, tagging, report (WIP) |
| L20 | Revision colors, `*` marks, page locking (WIP) |
| Comments | Inline range anchors in editor (WIP) |
| Menus | Full File/Edit/View/Format/Tools/Production wiring (WIP) |
| Collab | Deploy `services/collab`, `SW_COLLAB_WS_URL` + `SW_COLLAB_SECRET`, 2-tab verify |
| Addendum | **D01–D41** (`SCREENWRITING-BUILD.md` §D) — verify after P0 browser pass |

---

## 6. Login, credits, billing

Existing workspace auth and clip credits; full billing roadmap TBD.

---

## Milestone log

| Date | Milestone |
|------|-----------|
| 2026-10-26 | Screenwriting hidden (`FEATURE_SCREENWRITING`); roadmap created; clipper reprioritized |
| 2026-10-26 | Upload direct-to-storage shipped `64d759c87` |
