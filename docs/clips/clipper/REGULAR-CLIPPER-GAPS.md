# Regular clipper — open items (vs BIC + UI spec)

Scope: **VOD/upload clipper only** (`worker/clips_worker`, `new-app` clips). **Deferred:** Streamer real-time (EventSub live clips, live Kick chat markers) — do not expand `streamer/` live paths.

Source docs: `clipper-streamer-bic.md` §1, `clipper-streamer-ui-layouts.md` §1–3 (clipper surfaces only).

**Last gap pass (master):** caption/export 4:5 + grid aspect, results grid (trend/why/hide), people strip `nPersons`, auto zoom/emojis on initial edits, editor layout inspector basics.

## Prototype v3 vs live reframe v2

| Path | Role |
|------|------|
| `clips_worker/reframe_core.py` + `speakercrop_v2.py` | **Live v2** when `REFRAME_V=2` / `REFRAME_V2_ENABLED` |
| `prototype/v3/director.py`, `multiperson_pipeline.py` | **v1/prototype only** — not on the v2 hot path |
| Worker Docker `pytest` | v2 contract tests (`test_multiperson_clipper.py`, `test_reframe_*`); prototype stack in `test_prototype_v3_clipper.py` (run locally, not CI) |

| BIC / UI area | Gap | Primary file / function | Status |
|---|---|---|---|
| 1.1 Multimodal ClipAnything | Gemini vision shortlist not wired to picker | `anything_picker.py`, `pipeline.py` | **Done** (Luna primary + Gemini fallback) |
| 1.1 Trend grade + plain “why” on cards | No Trend sub-score; hook-only aiMeta | `picker.py`, project clip `aiMeta` | **Done** (`scores.trend`, `clipWhySummary`) |
| 1.1 Thumbs down / hide clip | No dislike → hide + replace | `new-app` results grid | **Done** hide + `userHidden`; replace clip still deferred |
| 1.1 Live ETA + progressive clip cards | No stage ETA in UI | `pipeline.post_progress`, project page | **Done** (`ProgressiveClipResults`, `JobStatus`) |
| 1.2 3–5 person re-ID on **default** path | `REFRAME_V=2` opt-in; routing added in follow-up PR | `render_clip.run_speakercrop`, `layout_router.py` | **Done** (default multiperson routing) |
| 1.2 Per-scene layout inside clip (auto) | v2 director in `reframe_core`; prototype v3 director separate | `reframe_core.viterbi_layout`, prototype `director.run_director` | Partial (runtime v2; full timeline UX deferred) |
| 1.2 Screen-share + speaker layout | No screen region detector | — (NEW) | Partial (probe + routing) |
| 1.2 PiP layout | Not in STYLE_MAP | `director.py` | Open |
| 1.2 1:1 / 4:5 export | Only 9:16, 1:1, 16:9 in settings | `settings.ts`, `aspect_size` | **Done** (4:5 export + grid uses project aspect) |
| 1.2 Per-segment timeline override UX | Shot overrides API partial; editor lanes thin | `preview-stage.tsx`, `edits.layout` | Partial (layout panel shots + reset; no timeline lanes) |
| 1.3 Auto zoom / punch-in | Not implemented | — | **Done** (project `autoZoom` → edits + keyword highlight) |
| 1.3 AI emojis on captions | Not implemented | `captions.py` | **Done** (project `autoEmojis` + post-pipeline + editor) |
| 1.3 B-roll auto-place | `autoStockBroll` flag; M9 glue incomplete | `broll_render.py` | Open |
| 1.4 Extend clip beyond AI bounds | Trim-only edits | `edits_render.py` | Open |
| 1.4 Publishing / scheduler | Download-only v1 | — | Deferred |
| 1.4 XML export, 4K60 | Not in export path | `render_job.py` | Open |
| UI §1 Results grid | Score letter grades, why line, layout chip on card | clip list components | **Done** |
| UI §1 “People found P1–P5” strip | No face thumbnails on project | project page | **Done** (badges from `aiMeta.nPersons`) |
| UI §2 Editor | Full inspector / segment layout menu per spec | `editor-shell.tsx` | Partial (AI/manual pill, layout shots, aspect/zoom in layout panel) |
| UI §3 Brand templates depth | Single template id | `brand` settings | Open |

**Still in progress / follow-up:** dislike → generate replacement clip; full timeline layout track + right-click menu per UI spec; PiP; B-roll M9; extend trim; XML/4K export.
