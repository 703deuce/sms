# Regular clipper — open items (vs BIC + UI spec)

Scope: **VOD/upload clipper only** (`worker/clips_worker`, `new-app` clips). **Deferred:** Streamer real-time (EventSub live clips, live Kick chat markers) — do not expand `streamer/` live paths.

Source docs: `clipper-streamer-bic.md` §1, `clipper-streamer-ui-layouts.md` §1–3 (clipper surfaces only).

| BIC / UI area | Gap | Primary file / function |
|---|---|---|
| 1.1 Multimodal ClipAnything | Gemini vision shortlist not wired to picker | `anything_picker.py`, `pipeline.py` |
| 1.1 Trend grade + plain “why” on cards | No Trend sub-score; hook-only aiMeta | `picker.py`, project clip `aiMeta` |
| 1.1 Thumbs down / hide clip | No dislike → hide + replace | `new-app` results grid |
| 1.1 Live ETA + progressive clip cards | No stage ETA in UI | `pipeline.post_progress`, project page |
| 1.2 3–5 person re-ID on **default** path | `REFRAME_V=2` opt-in; routing added in follow-up PR | `render_clip.run_speakercrop`, `layout_router.py` |
| 1.2 Per-scene layout inside clip (auto) | Director exists under v3; not default prod | `director.run_director`, `multiperson_pipeline.py` |
| 1.2 Screen-share + speaker layout | No screen region detector | — (NEW) |
| 1.2 PiP layout | Not in STYLE_MAP | `director.py` |
| 1.2 1:1 / 4:5 export | Only 9:16, 1:1, 16:9 in settings | `settings.ts`, `aspect_size` |
| 1.2 Per-segment timeline override UX | Shot overrides API partial; editor lanes thin | `preview-stage.tsx`, `edits.layout` |
| 1.3 Auto zoom / punch-in | Not implemented | — |
| 1.3 AI emojis on captions | Not implemented | `captions.py` |
| 1.3 B-roll auto-place | `autoStockBroll` flag; M9 glue incomplete | `broll_render.py` |
| 1.4 Extend clip beyond AI bounds | Trim-only edits | `edits_render.py` |
| 1.4 Publishing / scheduler | Download-only v1 | — |
| 1.4 XML export, 4K60 | Not in export path | `render_job.py` |
| UI §1 Results grid | Score letter grades, why line, layout chip on card | clip list components |
| UI §1 “People found P1–P5” strip | No face thumbnails on project | project page |
| UI §2 Editor | Full inspector / segment layout menu per spec | `editor-shell.tsx` |
| UI §3 Brand templates depth | Single template id | `brand` settings |

**In progress (this PR):** person-count routing → split/grid3/grid4/dynamic; calmer director/smoothing; layout modes in settings + `layout_env` parity.
