---
name: lab-engine-browser-contract
description: The contract every browser engine follows (PixiJS, three.js/Theatre, GSAP/SVG, p5, D3, MapLibre/deck.gl, Rive, Lottie, Skia): window.__scene seek(t), frame-exact capture with stills and alpha, layer stacking, per-scene export rules and the shared scenes/theme.json.
when_to_use: Attached at the build stage whenever this job's scenes/plan.json picks any browser engine (by video-stage, from the plan); named by lab-video-engines.
page_line: Browser-engine contract: seek(t) scenes, capture.mjs stills and alpha layers, layer stacking, per-scene export rules, shared theme.json.
attach_roles: stage
---

# Browser-engine contract (every browser engine)

Time comes only from `seek(t)`, never the wall clock: every frame exact and repeatable, revisions match.
Name the sections you need in `scenes/plan.json` `"refs"` (`lab-engine-browser-contract/reference.md#<heading>`).

- **Scene**: `scenes/<id>/index.html` sets `window.__scene = {fps: 30, duration, seek: async (t) => {...}}` and
  `window.__ready = true`, engine clock paused; engine build copied into `lib/`, fonts as files in `assets/`.
  Template and capture flags: `#0. The browser-engine contract`.
- **Capture**: `C=/workspace/skills/lab-engine-browser-contract/capture.mjs`; stills
  `node $C --dir scenes/S04 --still 0.5,2,3.8 --out scenes/S04/out/S04.png`; final `--out .../S04.mp4 --size 854x480`;
  alpha layer `--out .../S04.mov --alpha` (transparent page, alpha canvas, WebGL `preserveDrawingBuffer: true`).
- **Layers** bottom to top: background -> plate -> subject cut-out -> type -> fx, composited inside the scene
  runtime, never stacked in FFmpeg (`#0b. Using any engine as a LAYER`).
- **Export** each scene at exact frames, 30 fps CFR, H.264, no audio (`#Per-scene export rules`).
- **One art direction** from `scenes/theme.json`, mapped into every engine (`#One art direction`).
