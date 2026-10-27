# Transovo product roadmap

**Last updated:** 2026-10-27 — **Standing direction (Rick):** no MVP — every feature ships **complete and best-in-class**. Build order **1→4** below. **AI Studio ON HOLD** (Underlord / Overdub / Eye Contact); screenwriting on hold behind `FEATURE_SCREENWRITING`.  
**Prod clipper (2026-10-27):** Deepgram+Whisper fallback, B2 worker source cache, stage-aware ETA, 1080p export; script editor train ahead of origin (M1–M3+).

Single source of truth for build order and status. Update the **Last updated** line at every milestone.

---

## Standing direction (owner)

| Principle | Rule |
|-----------|------|
| **Quality bar** | No MVP. Ship each surface **complete and best-in-class**, not a thin slice. |
| **Working cadence** | During long runs: post a **short progress note every 10–15 minutes**. Never go silent — end with a **clear question** or **READY TO PUSH**. |
| **Vision LLM** | Clipper/reframe: **no vision-LLM checker at start**. Optional **Gemini 3.1 frame check** later **only if** quality gaps remain. |
| **Feature maps** | Checked in: `docs/clips/descript/` (596 features, gap matrix, recording-cost). Milestones **M7–M17** + **M18** desktop per `SCRIPT-EDITOR-BUILD.md` §0.2. |

---

## Build order (owner final — 2026-10-27)

| Phase | Product | Scope |
|-------|---------|--------|
| **1** | **Script editor** | Full **Descript-style** editor **including recording** (M14–M16 browser, LiveKit Cloud; M18 desktop post-launch). M1–M6 core + **M7–M17** per gap matrix. See `docs/clips/SCRIPT-EDITOR-BUILD.md` + `docs/clips/descript/`. |
| **2** | **Clipper (best-in-class)** | **3–5 person** tracking with **re-ID**; **auto layouts** — full frame, single follow, **2-person split**, **4-person grid** (upsize panels); **varied clip and edit styles**; **calmer speaker-follow** — Deepgram diarization primary, **LEAD ≤ 0**, **MIN_SEG 2–3 s**, **hold on dropout**; full [polish list](#2-clipper-best-in-class-phase-2) below. |
| **3** | **Streamer** | **Full Streamer** product — **near-real-time VOD clipping** (not true live). Resumable VOD, S2–S15 per `docs/clips/STREAMER_BUILD_SPEC.md` / `PROGRESS.md`. |
| **4** | **UI polish** | **Every page** — consistent UX, loading/empty/error, performance; **last** after 1–3. |

**Not in queue:** AI Studio (Higgsfield-like). **On hold:** Screenwriting (`FEATURE_SCREENWRITING=0`).

### Before charging (launch blocker)

| Blocker | Status |
|---------|--------|
| **Login, credits, billing** | **PARTIAL** — auth/credits exist; billing + charge-ready flows required before paid launch |

---

## 1. Script editor (phase 1 — active)

Descript-class editor: transcript, timeline, scenes, media, music, recording takes, export integration.

| Doc | Purpose |
|-----|---------|
| **`docs/clips/SCRIPT-EDITOR-BUILD.md`** | Milestones M1–M17 (+ M18); Prisma/API/component plan; B6–B13 via gap matrix |
| **`docs/clips/descript/gap-matrix.md`** | Launch matrix, B6–B13, §R recording, §D1b tests #67–#167 |
| **`docs/clips/descript/feature-map.md`** | Full Descript inventory (596 rows) |
| **`docs/clips/script-editor.md`** | Spec + §D1 tests **#1–#66** |
| **`docs/clips/script-editor-SOURCES.txt`** | Reference screenshots |

**Status (2026-10-27):** M1–M3 on prod; **M4** shipped (enrichment + filler/captions/reframe pills); **M5** next. Gap matrix merged in docs. **Do not** expose premature composition export until M5 passes §D1 #49–#60.

---

## 2. Clipper best-in-class (phase 2)

Runs **after** script editor phase 1 is complete (owner map + milestones). Reuses shared reframe/render stack with script editor.

### Core pipeline (already live — maintain)

Upload → `PROCESS_PROJECT` → transcribe → pick clips → `RENDER_CLIP` → export. See `docs/clips/clipping_build_plan.md`, `docs/clips/PROGRESS.md`.

| Layer | Notes |
|-------|--------|
| ASR | Deepgram primary, Whisper fallback |
| B2 / cache | Worker source cache, shared mount |
| Export | 1080p, B-roll via `broll_render.py` |

### Best-in-class deliverables (phase 2)

| Area | Target |
|------|--------|
| **Multi-person (3–5)** | Face tracks + **embedding re-ID** across cuts/head turns; map **Deepgram `spk`** → face via lip correlation |
| **Layouts** | Auto **full**, **single follow**, **2-up split**, **4-person grid**; top/bottom split when scene fits; no bad half-crops on two-shots |
| **Clip variety** | Diverse layout + caption/style choices **per clip** in a project (not one template for all) |
| **Speaker-follow calmness** | **LEAD ≤ 0**, **MIN_SEG 2–3 s**, higher hysteresis; sustained speech before switch; **hold** on face dropout; ignore pauses/backchannels |
| **Corner webcam** | Single stream + small PiP → don’t invent extra speakers; optional full-frame clip |
| **ETA / render** | Continue calibrating stage ETA; `CLIPS_RENDER_CONCURRENCY` / ffmpeg tuning |
| **Quality gate** | Ship without vision-LLM; add Gemini 3.1 frame check only if needed |

**Implementation home:** `v3/speakercrop_v2.py`, picker, `ClipEditsV2` layout, worker render.

---

## 3. Streamer (phase 3)

**Near-real-time VOD clipping** — not true live. Full milestone set in `docs/clips/STREAMER_BUILD_SPEC.md`.

| Priority open item | Notes |
|--------------------|--------|
| **VOD resumable download** | Checkpointed import; survive worker restart (`StreamVod.state`) |

---

## 4. UI polish (phase 4 — last)

Cross-app pass: every route, panel, and workflow — after script editor, clipper phase 2, and Streamer.

---

## AI Studio (on hold)

Higgsfield-like product. **Not in build queue.** Underlord chat, Overdub, Eye Contact stay with AI Studio.

---

## Screenwriting (on hold)

`FEATURE_SCREENWRITING=0` → 404. Branch `screenwriting-wip`; docs under `docs/clips/SCREENWRITING-*`.

---

## Milestone log

| Date | Milestone |
|------|-----------|
| 2026-10-27 | **Standing direction:** no MVP; order 1 script editor (+recording) → 2 clipper BIC → 3 Streamer → 4 UI polish |
| 2026-10-27 | Script editor: M3 timeline, M7–M13 docs, B-roll reuse §2.6, recording take model §2.7 |
| 2026-10-27 | Prod clipper: Deepgram+Whisper, B2 cache, ETA, 1080p (`db41e7a6b`) |
| 2026-10-27 | AI Studio **ON HOLD** |
| 2026-10-26 | Clipper upload/render fixes; screenwriting flag off |
