# Engine status (Motion Studio, this box)

| Engine | Status | Date | Notes |
|---|---|---|---|
| Cinematic Skill @ bf43556 | PASSING (production) | 2026-11-16 | Delivered msaj_5ed54d86 and msaj_ea717347 |
| Claude Remotion Skill @ 1dcbe5e | PASSING (smoke test) | 2026-11-16 06:51 ET | examples/: npm install OK (remotion 4.0.544, Node 24), npm run audio OK, render FocusCatPromo 465 frames 1920x1080 in ~1.5 min with system /usr/bin/google-chrome (no flag needed). qa_report: all video checks PASS; loudness FAIL -27.4 LUFS is the example's own quiet music-only mix (shipped videos/focus-cat-promo.mp4 measures -27.5 LUFS too), not an engine fault. Production use must loudnorm the master. Engine choice: Rick authorises it per job (the Transovo routine's own engine rule is owned by that routine). |
| Dolly @ a78a821 | PASSING (smoke test) | 2026-11-16 08:01 ET | new.sh into /workspace/engines/_tests/dolly-smoke OK (npm install + SFX gen), `remotion still Promo --frame=30` OK, `npm run promo` 735 frames 1920x1080 OK, `npm run check`: no failures (warnings: example mix -21 LUFS, two still stretches in the stock Promo). 101 s total incl. install. Used system Chrome via --browser-executable=/usr/bin/google-chrome. Engine choice: Rick authorises it per job (the Transovo routine's own engine rule is owned by that routine). |
| HyperFrames @ e426ce4 (CLI 0.9.52) | PASSING (smoke test) | 2026-11-16 08:00 ET | `npx hyperframes init _tests/hf-smoke --skip-skills`, lint OK, render 10 s blank template in 6.3 s (software GPU, beginframe capture). 19 s total. Telemetry opt-out env set (HYPERFRAMES_TELEMETRY=0, DO_NOT_TRACK=1). No HeyGen sign-in. Engine choice: Rick authorises it per job (the Transovo routine's own engine rule is owned by that routine). |
| Open 3D Skills @ 53beb89 | PASSING (smoke test) | 2026-11-16 08:02 ET | pip install requirements (playwright) into /workspace/motion_prod_env + playwright chromium; serve.py + record.py of the pavilion starter, 5 s @ 8 fps 1920x1080: 40 frames, no page errors, ~0.75 s real per frame (so 30 fps 1080p ≈ 22 s real per output second). three.js loads from jsDelivr CDN (needs network at record time). Frame viewed: correct. Motor demo not run. Engine choice: Rick authorises it per job (the Transovo routine's own engine rule is owned by that routine). |

## Motion-graphics library (installed 2026-11-16, ~13:00 ET)

Status for all rows: **installed, not render-tested**. Install finished without errors (log: `/workspace/motion_engines/_install/<engine>.log`). Rick's rule (16 Nov, 1:14 PM ET): no 2 s draft renders; go straight to the real scene render, fix or swap an engine that breaks, and record the result here. Details: `engine-library.md` in the motion-studio-production skill.

| Engine | Status | Install path | Render command (documented) |
|---|---|---|---|
| Motion Canvas @ 7b91435 (npm 3.17.2) | installed, not render-tested | `/workspace/motion_engines/motion-canvas` | `npx vite --port 9000` + puppeteer-core click Render in editor (or write scene in MC syntax and render with Revideo) |
| Revideo @ b5de67a (npm 0.11.0) | installed, not render-tested | `/workspace/motion_engines/revideo` | `node render.mjs` → `renderVideo({projectFile:'./src/project.ts', settings:{outFile, puppeteer:{executablePath:'/usr/bin/google-chrome'}}})` |
| PixiJS @ 1e70768 (pixi.js 8.23.0, pixi-filters 6.1.5) | **PASS (production render)** 2026-11-16 ~14:45 ET, chase_outage_30s all scenes: 210-particle plate + KawaseBlurFilter bloom, transparent canvas under DOM, needs import map `"pixi.js":"./lib/pixi.min.mjs"` for pixi-filters | `/workspace/motion_engines/pixijs` | `node {E}/_capture/capture.mjs --dir scenes/<id> --out out/<id>.mp4 --canvas '#c' [--alpha]` |
| Three.js @ 7922563 + Theatre.js @ 6ea82b9 (three 0.187.0, @theatre 0.7.2, postprocessing 6.39.6) | **three.js PASS (production render)** 2026-11-16 ~14:45 ET, chase_outage_30s S01–S02 (RoundedBoxGeometry phone, CanvasTexture screen + footage pane, alpha renderer, SwiftShader ~0.2 s/frame at 480x854 with DOM). Theatre/postprocessing not used yet | `/workspace/motion_engines/threejs-theatre` | capture.mjs `--canvas '#c' [--alpha]` |
| GSAP + SVG @ 5e6c35f (gsap 3.15.1) | **PASS (production render)** 2026-11-16 ~13:20 ET, gunna_social_30s_v3 S01–S07 | `/workspace/motion_engines/gsap-svg` | capture.mjs `[--alpha]` (timeline paused, seek(t)) |
| p5.js @ c60c735 (p5 2.4.0) | **PASS (production render)** 2026-11-16 ~13:20 ET, gunna_social_30s_v3 S01–S07 (paper + halftone layer, instance mode, noLoop/redraw on seek) | `/workspace/motion_engines/p5js` | capture.mjs `--canvas canvas [--alpha]` |
| Manim CE @ e8afc63 (0.22.1) | installed, not render-tested | `/workspace/motion_engines/manim/env` | `{E}/manim/env/bin/manim render -qh --fps 30 -r H,W scene.py Scene [--transparent --format mov]` (no LaTeX) |
| D3.js @ db118c9 (d3 7.9.2 + gsap) | **PASS (production render)** 2026-11-16 ~13:20 ET, gunna_social_30s_v3 S05 witness grid | `/workspace/motion_engines/d3` | capture.mjs `[--alpha]` |
| MapLibre GL @ dd1b28e + deck.gl @ dbfac3d (6.18.0 / 9.4.1) | installed, not render-tested | `/workspace/motion_engines/maplibre-deckgl` | capture.mjs `--canvas '.maplibregl-canvas'` (tiles need network) |
| Rive @ c654d76 (canvas-advanced 2.50.0) | installed, not render-tested | `/workspace/motion_engines/rive` | capture.mjs `--canvas '#c' [--alpha]` (needs a .riv file) |
| Lottie @ bede03d / dotLottie @ 9aa07ff (5.13.0 / 0.83.2) | installed, not render-tested | `/workspace/motion_engines/lottie` | capture.mjs `[--alpha]` |
| Skia CanvasKit (google/skia @ 549e9af noted; canvaskit-wasm 0.42.0) | **PASS (production render)** 2026-11-16 ~21:32 ET, phil_blount_30s full-film type layer: 936 frames 1080x1920, 4 Node workers in ~80 s, raw RGBA (readPixels Unpremul) piped to ProRes 4444; static TTF instances cut from Google variable fonts with fontTools instancer | `/workspace/motion_engines/skia-canvaskit` | `node frames.mjs | ffmpeg -f image2pipe -framerate 30 -i - …` (Node, no browser) |
| SAM 2 @ 2b90b9f (torch 2.15.0+cpu, sam2.1_hiera_tiny) | installed, not render-tested | `/workspace/motion_engines/sam2` | `{E}/sam2/venv/bin/python sam_track.py frames/ masks/ --point x,y` then ffmpeg alphamerge |
| rembg @ 991927b (u2net, u2net_human_seg, isnet-general-use) | **PASS (production)** 2026-11-16 ~13:17 ET, 5 stills u2net_human_seg in 5.3 s; clean edges (one stray neighbour sliver cropped on P01) | `/workspace/motion_engines/rembg` | `U2NET_HOME={E}/rembg/models {E}/rembg/venv/bin/rembg p -m u2net_human_seg in/ out/` |
| MediaPipe (wheel 1.2.3; repo @ 40a1ecc noted) | installed, not render-tested | `/workspace/motion_engines/mediapipe` | `{E}/mediapipe/venv/bin/python` Tasks ImageSegmenter + models/selfie_segmenter.tflite |
| OpenCV contrib headless 5.0.0 (opencv-python @ 56b7342 noted) | installed, not render-tested | `/workspace/motion_engines/opencv` | `{E}/opencv/venv/bin/python track.py` (CSRT tracker / Farneback flow) |
| Natron 2.5.0 portable (repo @ db3908d noted) | installed, not render-tested | `/workspace/motion_engines/natron` | `{E}/natron/natron-renderer -w Write1 1-90 comp.ntp` (headless not confirmed; FFmpeg/OpenCV substitute) |
| FFmpeg 7.1.5 system (FFmpeg @ e47940a noted) | **PASS (production)** 2026-11-16, gunna_social_30s_v3: lutrgb riso duotone, xfade slide pushes in gbrp, noise grain | `/usr/bin/ffmpeg` | filtergraph recipes in engine-library.md §16 |
| Browser frame-capture adapter | **PASS (production)** 2026-11-16 ~13:20 ET: 7 scenes 480x854 (74–174 frames each), 4 in parallel, ~50 s wall total, no page errors (favicon 404 is harmless) | `/workspace/motion_engines/_capture/capture.mjs` | `node capture.mjs --dir <scene> --out <file> [--size WxH] [--alpha] [--canvas sel]` |

## Library notes from first production use (gunna_social_30s_v3, 2026-11-16)
- No engine broke; no swaps. Fixes were in scene code, recorded so the next job gets it right first time:
  - GSAP paused timeline + capture.mjs: `tl.seek(0)` while the playhead is already at 0 renders nothing, so `set`/`from` states are not applied on frame 0. Prime once (`tl.seek(dur); tl.seek(0)`) before the first frame (done in that job's `scenes/_common/common.js`).
  - SplitText `type:'chars'` has no mask: a yPercent rise alone leaves the chars visible. Animate opacity too (or use `mask:'lines'`).
  - FFmpeg xfade on capture.mjs clips: put `setpts=PTS-STARTPTS` before `fps=30` (the other order gives "frame rate 1/0").
- Speed at 480x854: capture is about 0.25-0.35 s per frame per process for DOM + p5 halftone + footage-frame canvases.

## Library notes from chase_outage_30s (2026-11-16)
- No engine broke; no swaps. Scene-code lessons:
  - Syne ExtraBold is ~0.95 em per character: at 480 px wide, 10+ character words overflow above ~40 px. common.js now has `S.fit()` (shrinks `.disp` elements without an explicit width until they fit) — run it after fonts load.
  - Canvas-drawn text (three.js CanvasTexture) needs the fonts preloaded: `await document.fonts.load('800 40px Syne')` etc. in init, plus a hidden DOM element using each family.
  - pixi-filters imports the bare specifier `pixi.js`: add an import map so it resolves to the same `lib/pixi.min.mjs` instance.
  - Mixed WebGL (Pixi plate) + WebGL (three.js) + DOM in one page captures fine with a full-page screenshot (no `--canvas`).

## MediaPipe face models (downloaded 2026-11-16, 4:56 PM ET)

No test renders. Official files from `storage.googleapis.com/mediapipe-models`, version-pinned to `/float16/1/`, saved in `/workspace/motion_engines/mediapipe/models/`. Existing selfie segmenters were left in place.

| Model | Official URL | Local file | SHA-256 | Bytes |
|---|---|---|---|---|
| Face Landmarker (Tasks bundle) | https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task | `face_landmarker.task` | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` | 3,758,596 |
| Face Detector, short range | https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite | `blaze_face_short_range.tflite` | `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f` | 229,746 |
| Face Detector, full range | https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite | `blaze_face_full_range.tflite` | `3698b18f063835bc609069ef052228fbe86d9c9a6dc8dcb7c7c2d69aed2b181b` | 1,083,786 |

Google does not publish a Face Detector `.task` file; the official Tasks Face Detector model is `blaze_face_short_range.tflite` (full-range sibling added for group/wide frames). Face Landmarker is the official `.task` bundle and already includes a detector plus landmark and blendshape models. Use `/workspace/motion_engines/mediapipe/venv`.

## Library notes from phil_blount_30s (2026-11-16)
- Skia CanvasKit: use `readPixels(...alphaType: Unpremul)` and pipe `-f rawvideo -pix_fmt rgba` (much faster than PNG encode). Variable fonts render at the default instance; cut static weights with `python3 -m fontTools.varLib.instancer Font-VF.ttf wght=900 -o Font-Black.ttf`. Measure with `font.getGlyphWidths(font.getGlyphIDs(s))`.
- MediaPipe/OpenCV crops: input-seek (`-ss` before `-i`) landed ~0.3 s early on one music video (UiJmGT7IMLw, broken mmco refs); use output-seek for that source. Source letterboxing (HqRw 1920x810 active) makes 9:16 crops 2.4x upscales; cropdetect sources first.
- /tmp is shared by all agents on the box: write QA stills inside the job folder, not /tmp.
