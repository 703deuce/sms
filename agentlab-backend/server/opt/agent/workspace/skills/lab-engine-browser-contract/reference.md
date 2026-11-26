# browser contract: detail (from the Motion Studio engine pages, paths remapped to this lab)

## 0. The browser-engine contract (PixiJS, three.js/Theatre, GSAP/SVG, p5, D3, MapLibre/deck.gl, Rive, Lottie)

Every browser engine renders through `capture.mjs`, so they all behave the same way. Time is driven only by `seek(t)`, never by the wall clock. Each frame is exact and repeatable, and re-renders for revisions match.

Scene folder layout: `scenes/<id>/index.html`, `scenes/<id>/lib/` (copy the engine's browser build here, because the static server does not follow symlinks), `scenes/<id>/assets/`, `scenes/<id>/out/`.

```html
<!-- scenes/S04/index.html: minimal shape every browser scene follows -->
<html><body style="margin:0;background:transparent;overflow:hidden">
<canvas id="c"></canvas>
<script type="module">
  // import the engine from ./lib/..., build the scene, PAUSE its own clock
  window.__scene = { fps: 30, duration: 4.0, seek: async (t) => { /* draw exactly time t */ } };
  window.__ready = true;
</script></body></html>
```

```bash
C=/workspace/skills/lab-engine-browser-contract/capture.mjs
node $C --dir scenes/S04 --still 0.5,2,3.8 --out scenes/S04/out/S04.png       # review stills at the change points
node $C --dir scenes/S04 --out scenes/S04/out/S04.mp4 --size 854x480          # final: opaque clip, H.264
node $C --dir scenes/S04 --out scenes/S04/out/S04.mov --alpha                  # final: ProRes 4444 layer
```
Tested here (Chromium + SwiftShader WebGL). The page is screenshotted whole (this script has no `--canvas` flag).
- `--alpha` needs a transparent page (`background:transparent`) and a transparent canvas (alpha context, clear to 0 alpha).
- WebGL canvases need `preserveDrawingBuffer: true`.
- Fonts: put the `.ttf`/`.woff2` files in `assets/fonts/` with `@font-face`. The adapter waits for `document.fonts.ready`.
- Network: pages may load map tiles or fonts, so the adapter waits for `networkidle0`. Prefer local files.


## 0b. Using any engine as a LAYER (mix and match)

- **Opaque base layers** (backgrounds, plates): H.264 MP4 at the scene's exact frame count.
- **Layers with transparency:** ProRes 4444 `.mov` (`prores_ks -profile:v 4444 -pix_fmt yuva444p10le`), VP9-alpha `.webm` (`yuva420p`), or a PNG sequence. Engines with native alpha: Remotion (ProRes 4444 / VP9), HyperFrames (`--format mov|webm`), Manim (`--transparent`), Skia (PNG), and every browser engine through `capture.mjs --alpha`.
- **Composite** inside the scene runtime:
  - the browser scene / editable layer scene (`kind: video` or `image` layers, seeked by frame), the default;
  - Remotion, when layers need animated position or scale or react to the voice: `<OffthreadVideo transparent src={staticFile('type.webm')}/>` stacked in `<AbsoluteFill>`.
- Stack order bottom to top: background -> plate (real footage, prepared with `lab-engine-footage-fx`) -> subject cut-out -> type -> fx. Never stack scene layers in FFmpeg.
- **Blend in RGB, never premultiplied-to-black edges.** Check a cutout edge at 200% on a browser still before the final render. Keep every layer the same frame count and fps.


## Per-scene export rules (all engines)

Every scene is delivered as its own clip, so the editor can place it on a track:
- **Exact frame count.** Frames = round(planned duration × 30), 30 fps CFR, the job's resolution, H.264 yuv420p, CRF 16, `+faststart`, no audio (sound lives in the stems). Check it with `ffprobe -count_frames`.
- **Handles:** when a scene ends on a camera move, render 0.5 s of extra frames at each end into `scenes/<id>/out/<id>_handles.mp4`, so editor trims and revision re-timing have material. The main clip stays exact.
- **No baked fades** at scene edges unless the fade is the designed transition.
- **Source kept:** the scene folder (code, theme, assets references, `README.md` with the exact re-render command) is zipped into the source bundle.


## One art direction: `scenes/theme.json`
Written once at creative direction: palette (hex), fonts with files, grain, vignette, grade, easing family and spring
presets, safe areas, type treatments, text placement, transition grammar, pacing, texture. Map it into each engine:
CSS variables or a shared `theme.js` for browser engines, a config block for Manim, Cinematic `LOOK` dicts, Remotion
`src/theme.ts`, HyperFrames CSS variables, Open 3D constants at the top of `scene.js`.


# Browser engines: recipes (from Motion Studio engine-library.md, adapted to /opt/engines/js)

## GSAP + SVG type
- Paused timeline; `seek: t => tl.seek(t, false)`. Per-word reveal: split words into spans (or SplitText), `tl.from(words, {yPercent:100, opacity:0, stagger:0.06, ease:'power3.out'})`.
- Scramble/decode for data-noir; DrawSVG for underlines, map routes, signatures; MorphSVG for icon changes.
- Readability: words hold >= 0.3 s each, min 1.2 s per line; >= 4.5% of frame height; inside a 5% inset.

## PixiJS v8
```js
import * as PIXI from './lib/pixi.min.mjs';
const app = new PIXI.Application(); await app.init({width:854, height:480, backgroundAlpha:0, preserveDrawingBuffer:true, autoStart:false});
document.body.appendChild(app.canvas);
// build particles from a seeded RNG; in seek(t): set each sprite from t (no Math.random at draw time), then app.render()
```
Filters: `pixi-filters` (Glow, AdvancedBloom, RGBSplit, CRT, OldFilm, Displacement). Seed every random value so a re-render matches.

## p5.js
`new p5(s => { s.setup = () => { s.createCanvas(854,480); s.noLoop(); }; s.draw = () => {}; window.__p5 = s; })`; in `seek(t)`: `randomSeed(1)`, draw the state at t, `redraw()`.

## Lottie
`const anim = lottie.loadAnimation({container, renderer:'svg', loop:false, autoplay:false, path:'assets/a.json'})`; on `DOMLoaded` set `__ready`; `seek: t => anim.goToAndStop(t*1000, false)`. Recolour to the film palette; never ship a stock look unchanged.

## Rive
`new rive.Rive({src:'assets/a.riv', canvas, autoplay:false})`; advance with `r.scrub(animationName, t)` per seek.

## Skia / CanvasKit
`CanvasKitInit({locateFile: f => './lib/' + f})`; draw in `seek(t)` to a `MakeWebGLCanvasSurface` or `MakeSWCanvasSurface`; flush each frame. Good for variable-font weight morphs (`FontMgr` with the font file in assets) and SkSL runtime-effect backgrounds.

## Layer rules
- Same fps and frame count as the segment it sits on; t=0 = the segment's start on the narration clock.
- Blend in RGB, check a transparent edge at 200% on a still before the final render.
- One art direction: put palette, fonts, easing in `scenes/theme.json` and read it in every scene.
