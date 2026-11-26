# Engine support (only what was tested is claimed)

| engine / layer | editable via | live preview | export | tested on | evidence |
|---|---|---|---|---|---|
| **three.js r1xx + GSAP** (WebGL, SwiftShader) | `ms-props-core` adapter | yes | headless Chrome, seek per frame → x264 High@4.2 | Keith S01, S05 | P1–P5, P9 (`out/tests/suite/`) |
| DOM text over WebGL (title, pronunciation, location, year) | yes | yes | yes | Keith S01 | auto-fit, overflow rollback, safe area, glyph coverage |
| canvas2d text **in a WebGL texture** (headword on the page) | yes (texture redrawn) | yes | yes | Keith S01/S05 | projected bounds via `projectBounds` |
| WebGL image plane (portrait) | image, focal point, border colour; grade + auto focal point (render_editable) | yes (image/focal) | yes | Keith S01/S05 | `IMAGE_CROPPED`, `IMAGE_TOO_SMALL`, grade derived asset |
| logo (PNG / outlined SVG as an image) | yes | yes | yes | Keith S01 | P4 (SVG rendered, PNG preview job), `SVG_UNSAFE` refusal |
| **PixiJS** (texture text labels, alpha overlay) | yes | yes | ProRes 4444 alpha `.mov` → overlay in master | Phil S04 | P1 SSIM, live edit, PixiJS `TEXT_OVERFLOW`, P10 by worker B |
| **Python OpenCV + FFmpeg** (face-tracked push-in) | render_editable: zoom, framing, gamma | no; poster + `stillOnly` preview job | `render.py` | Phil sh04 | P1 bit-exact (SSIM 1.0), measure step (`IMAGE_UPSCALED`), P10 by worker B |
| MediaPipe BlazeFace | auto focal point, import-time face track | n/a | n/a | Keith portrait, Phil sh04 | focal (0.375, 0.298) on km_bw.jpg |
| FFmpeg master assembly (declarative recipe) | theme-bound values (`fadeColor`) | n/a | two-pass x264 High@4.2 | Keith, Phil masters | P1 (re-assembly vs delivered final), P9 framemd5 |

## Not claimed (stored and reused, or catalogued only)
- **CanvasKit** scenes (Phil `TY`): stored as original clips (non-editable). CanvasKit font availability is catalogued (1,560 faces probed) but no editable CanvasKit scene was tested.
- **skia-python, PIL, ffmpeg drawtext text**: font catalogs probed (1,584 faces each), but no editable scene renders text with them yet.
- **SVG text** (`<text>` in SVG): refused (`SVG_UNSAFE`), because fonts inside SVG are not pinned. Outlined SVG only.
- **D3, Remotion, Lottie, Blender, Unreal, Spline, Rive**: not tested here; no claim.
- **Keith S02–S04, OV** (complex multi-layer scenes) and every footage shot: reused as delivered clips; `NOT_THEME_AWARE` on theme changes.
- **GPU WebGL**: all results are on SwiftShader (software). A GPU browser in the editor should match, but that was not tested.

## Re-verification on the new producer box (2026-11-17, 4:58 PM ET)
The table above is carried over from the previous producer box and was **not** re-verified here: the full suite cannot run on
this box because `sim/` (the Transovo simulator + reference editor host) and the source productions under `/workspace/motion_tests/`
(keith_murray_doc_2min, phil_blount_30s) are not in the handoff kit. Verified here offline (no simulator, 480p or lower): the 14 schemas
compile; Keith S01 (three.js + GSAP, original scene code) renders a still and a 2 s 854x480 clip in headless Chrome/SwiftShader with no
page errors; the font probe (skia-python, PIL, Chrome, CanvasKit) passes on 11 fonts. See `out/SETUP_REPORT_20261117.md`.
