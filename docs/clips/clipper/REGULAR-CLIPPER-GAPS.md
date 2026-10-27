# Regular clipper — open items (vs BIC + UI spec)

Scope: **VOD/upload clipper only** (`worker/clips_worker`, `new-app` clips). **Deferred:** Streamer real-time (EventSub live clips, live Kick chat markers) — do not expand `streamer/` live paths.

Source docs: `clipper-streamer-bic.md` §1, `clipper-streamer-ui-layouts.md` §1–3 (clipper surfaces only).

**Last gap pass (master):** extend-trim timeline handles (8s), REPLACE_CLIP dislike flow, project failure copy + retry, export caption-off edge, zoom/emoji export tests, gaps doc refresh.

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
| 1.1 Thumbs down / hide clip | No dislike → hide + replace | `new-app` results grid, `REPLACE_CLIP` worker | **Done** hide + alternate moment job |
| 1.1 Live ETA + progressive clip cards | No stage ETA in UI | `pipeline.post_progress`, project page | **Done** (`ProgressiveClipResults`, `JobStatus`) |
| 1.2 3–5 person re-ID on **default** path | `REFRAME_V=2` opt-in; routing added in follow-up PR | `render_clip.run_speakercrop`, `layout_router.py` | **Done** (default multiperson routing) |
| 1.2 Per-scene layout inside clip (auto) | v2 director in `reframe_core`; prototype v3 director separate | `reframe_core.viterbi_layout`, prototype `director.run_director` | **Done** (runtime v2; per-shot editor overrides; no full timeline lane — deferred) |
| 1.2 Screen-share + speaker layout | No screen region detector | `screen_share_route.py` | **Done** (detect + `screen_pip` routing) |
| 1.2 PiP layout | Not in STYLE_MAP | `director.py`, editor layout panel | **Done** (`screen_pip` v2 + editor) |
| 1.2 1:1 / 4:5 export | Only 9:16, 1:1, 16:9 in settings | `settings.ts`, `aspect_size` | **Done** (4:5 export + grid uses project aspect) |
| 1.2 Per-segment timeline override UX | Shot overrides API partial; editor lanes thin | `layout-panel.tsx`, `timeline.tsx` | Partial (layout lane + context menu: split/cut section/segment layout; export uses dominant segment mode) |
| 1.3 Auto zoom / punch-in | Not implemented | — | **Done** (project `autoZoom` → edits + keyword highlight) |
| 1.3 AI emojis on captions | Not implemented | `captions.py` | **Done** (project `autoEmojis` + post-pipeline + editor) |
| 1.3 B-roll auto-place | `autoStockBroll` flag; M9 glue incomplete | `apply-project-auto-broll.ts` | **Done** (worker callback + `[clipper:broll]`) |
| 1.4 Extend clip beyond AI bounds | Trim-only edits | `trim_bounds.py`, `timeline.tsx` | **Done** (8s draggable In/Out + export `expanded_source_cut_ms`) |
| 1.4 Publishing / scheduler | Download-only v1 | — | Deferred |
| 1.4 XML export, 4K60 | Not in export path | `render_job.py` | Deferred (out of scope) |
| UI §1 Results grid | Score letter grades, why line, layout chip on card | clip list components | **Done** |
| UI §1 “People found P1–P5” strip | No face thumbnails on project | project page | **Done** (badges from `aiMeta.nPersons`) |
| UI §2 Editor | Full inspector / segment layout menu per spec | `editor-shell.tsx` | Partial (layout inspector + shots; no segment context menu — deferred) |
| UI §3 Brand templates depth | Single template id | `brand` settings | Deferred |
| Ops | Failed upload / transcribe / 0 clips / worker timeout UX | `project-failure-copy.ts`, `project-clips-view.tsx` | **Done** (typed copy + retry) |

**Still in progress / follow-up:** per-segment layout in worker reframe (export uses dominant segment); XML/4K export (deferred). **Done this pass:** reusable clip templates (caption+layout+brand), project/batch apply, results grid multi-select export/download/template; people strip on progressive results + P1 chip; editor picker-why/layout inspector; processing non-fatal error banner; clipper unit tests only (no `run_m4_pipeline` harness).
