# Motion-graphics engine library (beyond the five core engines)

This library widens what the films can look like. The five core engines (`engines.md`) are still first-class. These add new looks, plus processing and effect layers that work on real footage. The goal is **visual** diversity (layouts, type, pacing, colour, camera, treatments, transitions), and engines are the means to it. Choose for the concept and `visualDna` first, then steer away from what recent films used (SKILL.md, "Director rules"). There is no limit on how many engines or layers one film or one scene uses.

**Status.** On 16 Nov 2026 every engine below was installed under `/workspace/motion_engines/<engine>/` at the pinned commit. **None has rendered a frame on this box yet.** Before using one in a customer job, check `/workspace/motion_jobs/ENGINE_STATUS.md`. No draft or smoke renders (Rick's rule): go straight to the real scene render. If an engine breaks, fix it or swap it for another engine on purpose, and record PASS/FAIL and why in ENGINE_STATUS.md. Heavy 3D tools (Blender, Godot, Unreal) are deliberately left out because the box has no GPU.

**Where things live**
- Engines: `/workspace/motion_engines/<engine>/`. `src/` is the upstream repo at the pinned commit (read its docs and examples there). `node_modules/` or `venv/` is the runnable install.
- Install script and logs (to rebuild an engine): `/workspace/motion_engines/_install/install_all.sh`, `pins.txt`, `<engine>.log`, `results.tsv`.
- Shared browser frame-capture adapter: `/workspace/motion_engines/_capture/capture.mjs` (puppeteer-core plus system Chrome `/usr/bin/google-chrome`, software WebGL via SwiftShader; not yet render-tested).
- **What "pinned" means here:** each `src/` is the upstream default branch at the SHA in this file, fetched on 16 Nov 2026. The runnable JS installs are the current npm releases of those projects (versions recorded in each `package.json` / `package-lock.json`), not builds from `src/`. MediaPipe, OpenCV and Skia (CanvasKit) run from official wheels or npm builds, and their repo SHAs are recorded for reference only (no source clone). Manim, rembg and SAM 2 are installed from `src/` at the pin.
- Restore an engine: `bash /workspace/motion_engines/_install/install_all.sh js|py|natron` (it re-fetches each `src/` at the SHA in `pins.txt`).

**Box facts that shape every recipe:** Linux, Node 24, Python 3.13 (3.12 venvs where wheels need it), 8 cores, about 15 GB RAM shared with other agents, **CPU only**. WebGL runs on SwiftShader, so it works but is slow: keep WebGL scenes short or at draft scale until the final render. Take the render lock (SKILL.md Stage 7) for anything heavy.

---

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
C=/workspace/motion_engines/_capture/capture.mjs
node $C --dir scenes/S04 --out scenes/S04/out/S04.tmp.mp4 --size 1080x1920            # opaque scene clip
node $C --dir scenes/S04 --out scenes/S04/out/S04_layer.mov --size 1080x1920 --alpha    # ProRes 4444 layer
node $C --dir scenes/S04 --out scenes/S04/out/S04_layer.webm --alpha --canvas '#c'      # VP9-alpha, canvas grab (faster for WebGL)
node $C --dir scenes/S04 --out /tmp/S04_draft.mp4 --size 480x854 --to 2                 # first-use 2 s draft
```
- `--alpha` needs a transparent page (`background:transparent`) and a transparent canvas (alpha context, clear to 0 alpha).
- `--canvas` needs `preserveDrawingBuffer: true` on WebGL canvases.
- Fonts: put the `.ttf`/`.woff2` files in `assets/fonts/` with `@font-face`. The adapter waits for `document.fonts.ready`.
- Network: pages may load map tiles or fonts, so the adapter waits for `networkidle0`. Prefer local files.

## 0b. Using any engine as a LAYER (mix and match)

Every element in a scene is a stack of layers, bottom to top, for example: `background` (PixiJS particles), `plate` (real footage, graded with FFmpeg), `subject` (SAM/rembg cutout of the player), `type` (GSAP SplitText headline, placed *behind* the subject), `fx` (grain, light leak). Each layer renders on its own:
- **Opaque base layers** (backgrounds, plates): H.264 MP4 at the scene's exact frame count.
- **Layers with transparency:** ProRes 4444 `.mov` (`prores_ks -profile:v 4444 -pix_fmt yuva444p10le`), VP9-alpha `.webm` (`yuva420p`), or a PNG sequence. Engines with native alpha: Remotion (ProRes 4444 / VP9), HyperFrames (`--format mov|webm`), Manim (`--transparent`), Skia (PNG), and every browser engine through `capture.mjs --alpha`.
- **Composite** in one of two ways:
  - FFmpeg (fast, no code):
    ```bash
    ffmpeg -i bg.mp4 -i plate.mp4 -i type.mov -i subject.mov -filter_complex \
     "[0][1]overlay=0:0[a];[a][2]overlay=0:0[b];[b][3]overlay=0:0,format=yuv420p" -frames:v $N -c:v libx264 -crf 16 S05.tmp.mp4
    ```
  - Remotion, when layers need animated position or scale or react to the voice: `<OffthreadVideo transparent src={staticFile('type.webm')}/>` stacked in `<AbsoluteFill>`.
- **Blend in RGB, never premultiplied-to-black edges.** Check a cutout edge at 200% on one frame before the full render. Keep every layer the same frame count and fps.
- Record the stack on the element in `project.json` (`layers[]`, see `delivery-contract.md` §5).

---

## 1. Motion Canvas

- **Repo:** https://github.com/motion-canvas/motion-canvas @ `7b91435` · **Install:** `/workspace/motion_engines/motion-canvas/` (npm: `@motion-canvas/core`, `2d`, `ui`, `vite-plugin`, `ffmpeg`, `vite@5`)
- **Best at:** precise, programmatic vector animation driven by generators and signals. Code blocks that morph line by line, diagrams, flowcharts, maths-style explainers, tidy shape choreography.
- **Signature:** clean, flat, exact vector motion with springy procedural tweens. It feels "engineered", like a YouTube explainer. Great for "how it works" beats, a strong change from Cinematic's paper world.
- **Headless render:** Motion Canvas renders from its editor, not a CLI. Run `npx vite --port 9000`, open the editor with puppeteer-core (system Chrome), set the exporter (FFmpeg video, or Image sequence for alpha), and click **Render**. Output lands in `output/`. Revideo (next entry) uses the same scene API with a real headless `renderVideo()`. **For unattended renders, write the scene in Motion Canvas syntax and render it with Revideo.** Use the Motion Canvas editor route only if a Motion Canvas-only feature is needed.
- **Install (done):** `cd /workspace/motion_engines/motion-canvas && npm i @motion-canvas/core @motion-canvas/2d @motion-canvas/ui @motion-canvas/vite-plugin @motion-canvas/ffmpeg vite@5 typescript`
- **Minimal recipe:**
  ```ts
  // src/scenes/s.tsx
  import {makeScene2D, Txt, Rect} from '@motion-canvas/2d'; import {createRef, all, waitFor} from '@motion-canvas/core';
  export default makeScene2D(function* (view) { const t = createRef<Txt>();
    view.add(<Txt ref={t} text="4TH QUARTER" fontFamily="Anton" fontSize={140} fill="#fff" opacity={0}/>);
    yield* all(t().opacity(1, 0.4), t().scale(1.15, 2)); yield* waitFor(1); });
  // src/project.ts: makeProject({scenes: [s]})   vite.config.ts: plugins: [motionCanvas(), ffmpeg()]
  ```
- **As a layer:** set the project background to transparent and export an **Image sequence** (PNG with alpha), then `ffmpeg -framerate 30 -i %06d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le layer.mov`.
- **Status:** installed, not render-tested.

## 2. Revideo

- **Repo:** https://github.com/redotvideo/revideo @ `b5de67a` · **Install:** `/workspace/motion_engines/revideo/` (npm: `@revideo/core`, `2d`, `renderer`, `vite-plugin`, `ffmpeg`, `vite@5`)
- **Best at:** Motion Canvas-style scenes rendered headlessly from Node, plus video and audio elements in the scene graph. Good for templated-feeling *structures* that you dress differently each time: data-driven lists, rankings, stat runs, footage with animated masks.
- **Signature:** the same crisp procedural vector feel as Motion Canvas. Strong for masks, morphing shapes over footage, and code-driven counters.
- **Headless render:** `renderVideo()` from `@revideo/renderer` drives Chrome through puppeteer. Point it at system Chrome.
- **Install (done):** `cd /workspace/motion_engines/revideo && PUPPETEER_SKIP_DOWNLOAD=1 npm i @revideo/core @revideo/2d @revideo/renderer @revideo/vite-plugin @revideo/ffmpeg vite@5 typescript`
- **Minimal recipe:**
  ```ts
  // render.mjs (run with: node render.mjs, from a scene folder holding src/project.ts)
  import {renderVideo} from '@revideo/renderer';
  await renderVideo({ projectFile: './src/project.ts',
    settings: { outFile: 'S06.mp4', outDir: './out', logProgress: true, workers: 2,
                puppeteer: { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] } } });
  // src/project.ts: import {makeProject} from '@revideo/core'; export default makeProject({scenes:[s], settings:{shared:{size:{x:1080,y:1920}}}});
  ```
  Check option names against `src/packages/renderer` at the pin on first use, and trim with `-frames:v` to the exact frame count.
- **As a layer:** the renderer writes opaque MP4. For a transparent layer, use the Motion Canvas Image-sequence route above, or build that layer in a `capture.mjs` engine. Never key out a flat colour.
- **Status:** installed, not render-tested.

## 3. PixiJS (v8)

- **Repo:** https://github.com/pixijs/pixijs @ `1e70768` · **Install:** `/workspace/motion_engines/pixijs/` (npm: `pixi.js`, `pixi-filters`)
- **Best at:** fast 2D WebGL: thousands of particles, sprite swarms, displacement and liquid distortions, glow, bloom, RGB-split, CRT and old-film filters, and photo shatter or explode effects.
- **Signature:** energetic, glowing, textured 2D. Sports-hype energy, neon, kinetic backgrounds, photos that ripple or burst.
- **Headless render:** `capture.mjs --canvas '#c'`. Create the app with `autoStart:false` and drive it from `seek`.
- **Install (done):** `cd /workspace/motion_engines/pixijs && npm i pixi.js pixi-filters`. Copy into the scene: `cp node_modules/pixi.js/dist/pixi.min.mjs node_modules/pixi-filters/dist/pixi-filters.mjs scenes/<id>/lib/`
- **Minimal recipe:**
  ```js
  import * as PIXI from './lib/pixi.min.mjs';
  const app = new PIXI.Application(); await app.init({ canvas: document.getElementById('c'), width: 1080, height: 1920,
    backgroundAlpha: 0, antialias: true, autoStart: false, preference: 'webgl', preserveDrawingBuffer: true });
  app.ticker.stop(); const dots = [...Array(800)].map((_, i) => { const g = new PIXI.Graphics().circle(0, 0, 3).fill(0xffd34d); app.stage.addChild(g); return g; });
  window.__scene = { fps: 30, duration: 3, seek: async t => { dots.forEach((g, i) => { g.x = 540 + Math.cos(i + t) * (i % 400); g.y = 960 + Math.sin(i * 1.7 + t) * (i % 500); }); app.render(); } };
  window.__ready = true;
  ```
- **As a layer:** `backgroundAlpha:0` plus `--alpha --canvas '#c'` gives a WebM or MOV particle or FX layer, under the type and over the plate.
- **Status:** installed, not render-tested.

## 4. Three.js + Theatre.js

- **Repos:** https://github.com/mrdoob/three.js @ `7922563` · https://github.com/theatre-js/theatre @ `6ea82b9` · **Install:** `/workspace/motion_engines/threejs-theatre/` (npm: `three`, `@theatre/core`, `@theatre/studio`, `postprocessing`; Theatre source in `theatre-src/`)
- **Best at:** keyframed 3D choreography: a camera that eases through 3D type, floating photo cards in space, product or object turntables, depth-of-field reveals, bloom. Theatre gives curve-edited keyframes across many objects, and `postprocessing` adds bloom, DOF, chromatic aberration and noise.
- **Signature:** glossy, cinematic 2.5D/3D motion design: extruded titles, photo planes in depth, light sweeps that are real light. It differs from Open 3D Skills (procedural environments and worlds); use this for *motion-design* 3D.
- **Headless render:** `capture.mjs --canvas '#c'` (SwiftShader). Keep scenes short; draft at 480p.
- **Install (done):** `cd /workspace/motion_engines/threejs-theatre && npm i three @theatre/core @theatre/studio postprocessing`. Copy `node_modules/three/build/three.module.js` and `three.core.js` (r187 splits the build), `node_modules/three/examples/jsm/` (only what you import), `node_modules/@theatre/core/dist/` and `node_modules/postprocessing/build/` into `lib/`, and use an import map.
- **Keyframes without the Studio UI:** load `@theatre/studio` in the page and author keyframes in code with `studio.transaction(({set}) => …)`, scrubbing `sequence.position`. Export the state with `studio.createContentOfSaveFile('<project>')` to `theatre-state.json`. The render page loads only `@theatre/core` with `getProject('<project>', {state})`.
- **Minimal recipe:**
  ```js
  import * as THREE from 'three'; import {getProject, types} from '@theatre/core';
  const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true }); r.setSize(1080, 1920, false); r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.1, 100);
  const sheet = getProject('S07', { state }).sheet('main'); const camObj = sheet.object('cam', { z: types.number(12), y: types.number(0) });
  camObj.onValuesChange(v => { cam.position.set(0, v.y, v.z); cam.lookAt(0, 0, 0); });
  window.__scene = { fps: 30, duration: 4, seek: async t => { sheet.sequence.position = t; r.render(scene, cam); } }; window.__ready = true;
  ```
- **As a layer:** `alpha:true` plus clear alpha 0 plus `--alpha` gives 3D type or objects over footage. Add the light sweep as its own additive layer.
- **Status:** installed, not render-tested.

## 5. GSAP + SVG

- **Repo:** https://github.com/greensock/GSAP @ `5e6c35f` · **Install:** `/workspace/motion_engines/gsap-svg/` (npm: `gsap`; every plugin is in the free package: SplitText, MorphSVG, DrawSVG, ScrambleText, MotionPath, CustomEase)
- **Best at:** typography and vector motion with designer-grade easing: per-character, word or line reveals, scramble or decode text, strokes drawing on, shape morphs, icons along paths, editorial lower thirds.
- **Signature:** crisp, typographic, magazine-like. This is the main tool for **typography variety**: the same headline can be split-staggered, masked line reveals, scrambled, drawn as outline then filled, or stacked and condensed.
- **Headless render:** `capture.mjs` (full-page screenshot; no canvas needed). Build one `gsap.timeline({paused:true})` and seek it.
- **Install (done):** `cd /workspace/motion_engines/gsap-svg && npm i gsap`. Copy `node_modules/gsap/dist/{gsap,SplitText,DrawSVGPlugin,MorphSVGPlugin,ScrambleTextPlugin}.min.js` into `lib/`.
- **Minimal recipe:**
  ```html
  <h1 id="h" style="font:900 150px/0.9 'Archivo Black';color:#fff">CMC TAKES OVER</h1>
  <script src="lib/gsap.min.js"></script><script src="lib/SplitText.min.js"></script><script>
  gsap.registerPlugin(SplitText); gsap.ticker.lagSmoothing(0);
  const tl = gsap.timeline({ paused: true }); const s = SplitText.create('#h', { type: 'chars,lines', mask: 'lines' });
  tl.from(s.chars, { yPercent: 110, stagger: 0.025, duration: 0.6, ease: 'expo.out' }).to('#h', { letterSpacing: '0.04em', duration: 2 }, 0);
  window.__scene = { fps: 30, duration: 3, seek: async t => tl.seek(t, false) }; window.__ready = true; </script>
  ```
- **As a layer:** transparent body plus `--alpha` gives a ProRes or WebM type layer, placed behind a SAM or rembg subject for text-behind-player shots.
- **Status:** installed, not render-tested.

## 6. p5.js (2.x)

- **Repo:** https://github.com/processing/p5.js @ `c60c735` · **Install:** `/workspace/motion_engines/p5js/` (npm: `p5`)
- **Best at:** generative and organic visuals: noise flow fields, halftone and dither treatments of photos, hand-drawn wobble lines, ink and paper textures, pixel sorting, glitch, generative backgrounds that react to audio amplitude.
- **Signature:** artsy, handmade, analogue-digital. Good for gritty editorial collage, zine, retro and glitch DNA.
- **Headless render:** `capture.mjs --canvas 'canvas'`. Use instance mode with `noLoop()` and redraw on seek.
- **Install (done):** `cd /workspace/motion_engines/p5js && npm i p5`. `cp node_modules/p5/lib/p5.min.js scenes/<id>/lib/`
- **Minimal recipe:**
  ```js
  let T = 0; const inst = new p5(s => { s.setup = () => { s.createCanvas(1080, 1920); s.pixelDensity(1); s.noLoop(); };
    s.draw = () => { s.clear(); s.stroke(255, 60); for (let i = 0; i < 400; i++) { const a = s.noise(i * 0.01, T * 0.3) * s.TWO_PI * 2; s.line(i * 2.7, 960, i * 2.7 + Math.cos(a) * 80, 960 + Math.sin(a) * 80); } }; });
  window.__scene = { fps: 30, duration: 3, seek: async t => { T = t; inst.redraw(); } }; window.__ready = true;
  ```
  Seed randomness (`s.randomSeed`, `s.noiseSeed`) so frames repeat exactly. Load photos with `await s.loadImage()` before `__ready`.
- **As a layer:** `clear()` instead of `background()` plus `--alpha` gives a texture, scribble or grain layer.
- **Status:** installed, not render-tested.

## 7. Manim (Community)

- **Repo:** https://github.com/ManimCommunity/manim @ `e8afc63` · **Install:** `/workspace/motion_engines/manim/env` (Python 3.12 env with cairo, pango, pycairo and manimpango from conda-forge via `manim/bin/micromamba`; manim itself pip-installed from `src/` at the pin, v0.22.1). The box's Debian apt mirror was unreachable, so system dev libraries were not used.
- **Best at:** maths and logic explainers: plotted graphs that grow, number lines, geometric transforms, equations morphing, step-by-step diagrams, probability and stat visuals.
- **Signature:** the 3Blue1Brown look: dark field, precise strokes, objects transforming into each other.
- **Headless render (native CLI, no browser):**
  ```bash
  M=/workspace/motion_engines/manim/env/bin/manim
  $M render -qh --fps 30 -r 1080,1920 scene.py StatsRise -o S08.mp4             # opaque
  $M render -qh --fps 30 -r 1080,1920 --transparent --format mov scene.py StatsRise   # alpha .mov layer
  $M render -ql -r 480,854 scene.py StatsRise                                   # draft
  ```
  `-r` is height,width. Output goes in `media/videos/...`; move it to `scenes/<id>/out/`.
- **Install (done):** `MAMBA_ROOT_PREFIX=$PWD/mamba bin/micromamba create -y -p $PWD/env -c conda-forge python=3.12 pycairo manimpango pip && env/bin/python -m pip install ./src`. **LaTeX is not installed**, so `MathTex`/`Tex` will fail. Use `Text`, `MarkupText` and `DecimalNumber` (Pango), or add a TeX distribution to the env (for example conda-forge `texlive-core`, large) only if a film truly needs typeset maths.
- **Minimal recipe:**
  ```python
  from manim import *
  class StatsRise(Scene):
      def construct(self):
          ax = Axes(x_range=[0,4,1], y_range=[0,50,10], x_length=8, y_length=5)
          g = ax.plot_line_graph([0,1,2,3,4], [0,14,27,40,46], line_color=YELLOW)
          self.play(Create(ax), run_time=0.6); self.play(Create(g), run_time=1.8); self.wait(0.6)
  ```
- **As a layer:** `--transparent --format mov` gives an alpha graph over footage or a background.
- **Status:** installed, not render-tested.

## 8. D3.js (SVG, animated with GSAP)

- **Repo:** https://github.com/d3/d3 @ `db118c9` · **Install:** `/workspace/motion_engines/d3/` (npm: `d3`, `gsap`)
- **Best at:** real data as graphics: bar races, line charts drawing on, scatter swarms, force networks of people, map projections (d3-geo), timelines, box-score breakdowns, stat comparison bars.
- **Signature:** editorial data journalism (NYT, The Pudding). Precise, information-dense, credible.
- **Headless render:** `capture.mjs`. Don't use d3 transitions (they run on a timer). Compute each frame from `t`: use d3 scales and interpolators with a GSAP paused timeline, or set attributes directly from `t`.
- **Install (done):** `npm i d3 gsap`. `cp node_modules/d3/dist/d3.min.js node_modules/gsap/dist/gsap.min.js scenes/<id>/lib/`
- **Minimal recipe:**
  ```js
  const data = [{k:'SF',v:46},{k:'DAL',v:40}]; const x = d3.scaleLinear([0,50],[0,800]);
  const bars = d3.select('svg').selectAll('rect').data(data).join('rect').attr('y',(d,i)=>200+i*140).attr('height',100).attr('fill',(d,i)=>i?'#041e42':'#aa0000');
  const tl = gsap.timeline({paused:true}); data.forEach((d,i)=> tl.fromTo(bars.nodes()[i], {attr:{width:0}}, {attr:{width:x(d.v)}, duration:1.2, ease:'power3.out'}, i*0.15));
  window.__scene = { fps:30, duration:3, seek: async t => tl.seek(t,false) }; window.__ready = true;
  ```
- **As a layer:** a transparent SVG chart plus `--alpha` gives a stat overlay on a footage plate or a 3D background.
- **Status:** installed, not render-tested.

## 9. MapLibre GL JS + deck.gl

- **Repos:** https://github.com/maplibre/maplibre-gl-js @ `dd1b28e` · https://github.com/visgl/deck.gl @ `dbfac3d` · **Install:** `/workspace/motion_engines/maplibre-deckgl/` (npm: `maplibre-gl`, `deck.gl`, `@deck.gl/mapbox`; deck.gl source in `deckgl-src/`)
- **Best at:** real vector maps with 3D camera flights (pitch, bearing), extruded 3D buildings, terrain, animated arcs between cities, trips layers (moving paths), heatmaps, hex bins, route lines that draw on.
- **Signature:** broadcast-news or Google-Earth-style map flights with real geography. A different look from Cinematic's printed-paper maps.
- **Headless render:** `capture.mjs --canvas '.maplibregl-canvas'`. On each `seek`, compute the camera from `t`, call `map.jumpTo({...})`, then `await new Promise(r => map.once('idle', r))` so the tiles are loaded before the frame is grabbed. Tiles need network at render time. A free style with no key is `https://tiles.openfreemap.org/styles/liberty` (or `https://demotiles.maplibre.org/style.json` for a plain base). Restyle the layers to the film's palette; never ship the stock style.
- **Install (done):** `npm i maplibre-gl deck.gl @deck.gl/mapbox`. Copy `node_modules/maplibre-gl/dist/maplibre-gl.mjs`, `maplibre-gl-shared.mjs`, `maplibre-gl-worker.mjs` and `maplibre-gl.css` (v6 ships ES modules: `import * as maplibregl from './lib/maplibre-gl.mjs'`), and `node_modules/deck.gl/dist.min.js` (global `deck`), into `lib/`.
- **Minimal recipe:**
  ```js
  const map = new maplibregl.Map({ container: 'm', style: 'https://tiles.openfreemap.org/styles/liberty', interactive: false, fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true }, center: [-97.09, 32.75], zoom: 12, pitch: 60 });
  const overlay = new deck.MapboxOverlay({ layers: [] }); map.addControl(overlay); await new Promise(r => map.on('load', r));
  window.__scene = { fps: 30, duration: 4, seek: async t => { map.jumpTo({ zoom: 12 + t * 0.9, bearing: -20 + t * 12, pitch: 60 });
    overlay.setProps({ layers: [new deck.ArcLayer({ id: 'a', data: [{ s: [-122.4, 37.77], e: [-97.09, 32.75] }], getSourcePosition: d => d.s, getTargetPosition: d => d.e, getWidth: 6, getSourceColor: [170,0,0], getTargetColor: [4,30,66] })] });
    await new Promise(r => map.once('idle', r)); } }; window.__ready = true;
  ```
  `canvasContextAttributes` is the v6 option name (confirmed in the installed `maplibre-gl.d.ts`).
- **As a layer:** map canvases are opaque. Use the map as the base plate, and put type and cutouts over it.
- **Status:** installed, not render-tested.

## 10. Rive

- **Repo:** https://github.com/rive-app/rive-wasm @ `c654d76` (runtime core: https://github.com/rive-app/rive-runtime @ `b36f5c8`) · **Install:** `/workspace/motion_engines/rive/` (npm: `@rive-app/canvas`, `@rive-app/canvas-advanced`)
- **Best at:** playing `.riv` files: state-machine character and UI animations, animated icons, mascots, buttons and counters with designer polish. Text runs and inputs can be changed at runtime.
- **Signature:** smooth, app-like, playful vector character motion.
- **Limit:** `.riv` files are authored in the Rive editor, and the bot can't author them in code. Use files from the Rive community library (rive.app/community), or files the customer provides. Change text runs, colours and inputs per film so it never looks stock.
- **Headless render:** `capture.mjs --canvas '#c'` with the low-level `@rive-app/canvas-advanced` runtime. Rive is stateful, so `seek` advances the artboard by the delta since the last frame (the adapter always seeks forward).
- **Install (done):** `npm i @rive-app/canvas @rive-app/canvas-advanced`. Copy `node_modules/@rive-app/canvas-advanced/{canvas_advanced.mjs,rive.wasm,rive_fallback.wasm}` into `lib/`.
- **Minimal recipe:**
  ```js
  import RiveCanvas from './lib/canvas_advanced.mjs';
  const rive = await RiveCanvas({ locateFile: f => './lib/' + f }); const renderer = rive.makeRenderer(c);
  const file = await rive.load(new Uint8Array(await (await fetch('assets/badge.riv')).arrayBuffer()));
  const ab = file.defaultArtboard(); const sm = new rive.StateMachineInstance(ab.stateMachineByIndex(0), ab); let last = 0;
  window.__scene = { fps: 30, duration: 3, seek: async t => { const dt = t - last; last = t; sm.advance(dt); ab.advance(dt);
    renderer.clear(); renderer.save(); renderer.align(rive.Fit.contain, rive.Alignment.center, { minX: 0, minY: 0, maxX: c.width, maxY: c.height }, ab.bounds); ab.draw(renderer); renderer.restore(); renderer.flush(); } };
  window.__ready = true;
  ```
- **As a layer:** transparent canvas plus `--alpha` gives an animated badge, icon or mascot layer.
- **Status:** installed, not render-tested.

## 11. Lottie / dotLottie

- **Repos:** https://github.com/airbnb/lottie-web @ `bede03d` · https://github.com/LottieFiles/dotlottie-web @ `9aa07ff` · **Install:** `/workspace/motion_engines/lottie/` (npm: `lottie-web`, `@lottiefiles/dotlottie-web`; dotLottie source in `dotlottie-src/`)
- **Best at:** After Effects-made vector animations: animated icons, shape bursts, arrows, underlines, scribbles, loaders, emoji-style accents. There is a huge public library on LottieFiles, and the bot can also write simple Lottie JSON itself.
- **Signature:** motion-designer accents (shape-layer pops, line flourishes). Best as small layers, not whole scenes.
- **Headless render:** `capture.mjs`. With lottie-web (SVG renderer), seek with `anim.goToAndStop(t * anim.frameRate, true)`. With dotLottie (ThorVG canvas), seek with `dl.setFrame(t * fps)`.
- **Install (done):** `npm i lottie-web @lottiefiles/dotlottie-web`. Copy `node_modules/lottie-web/build/player/lottie.min.js` (or the dotlottie-web ESM build and its wasm) into `lib/`.
- **Minimal recipe:**
  ```js
  const anim = lottie.loadAnimation({ container: document.getElementById('l'), renderer: 'svg', loop: false, autoplay: false, path: 'assets/burst.json' });
  await new Promise(r => anim.addEventListener('DOMLoaded', r));
  window.__scene = { fps: 30, duration: anim.getDuration(), seek: async t => anim.goToAndStop(Math.min(t * anim.frameRate, anim.totalFrames - 1), true) };
  window.__ready = true;
  ```
  Recolour the JSON to the film's palette before use.
- **As a layer:** natively transparent. `--alpha` gives a WebM or MOV accent layer, timed to a hit word.
- **Status:** installed, not render-tested.

## 12. Skia / CanvasKit

- **Repo:** https://github.com/google/skia @ `549e9af` (pin noted; the source tree is huge and was not cloned) · **Install:** `/workspace/motion_engines/skia-canvaskit/` (npm: `canvaskit-wasm`)
- **Best at:** high-quality 2D drawn **directly in Node with no browser**: shaped paragraph text with any font file, variable-font weight animation, SkSL runtime shaders (procedural gradients, noise, liquid backgrounds), path effects (dashes, trims, discrete jitter), blur and shadows.
- **Signature:** smooth, print-quality type and procedural shader backgrounds. A cheap way to get luxury, Swiss or minimal DNA without a browser.
- **Headless render:** a Node script draws each frame on a CPU raster surface and pipes PNGs to ffmpeg.
- **Install (done):** `cd /workspace/motion_engines/skia-canvaskit && npm i canvaskit-wasm`
- **Minimal recipe:**
  ```js
  // node frames.mjs | ffmpeg -f image2pipe -framerate 30 -i - -frames:v 90 -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le out.mov
  import CanvasKitInit from 'canvaskit-wasm'; import fs from 'node:fs';
  const CK = await CanvasKitInit(); const surf = CK.MakeSurface(1080, 1920); const c = surf.getCanvas();
  const font = CK.Typeface.MakeFreeTypeFaceFromData(fs.readFileSync('assets/fonts/Inter-Black.ttf'));
  const paint = new CK.Paint(); paint.setColor(CK.WHITE); paint.setAntiAlias(true);
  for (let i = 0; i < 90; i++) { const t = i / 30; c.clear(CK.TRANSPARENT);
    c.drawText('FINAL', 120, 960, paint, new CK.Font(font, 160 + t * 20));
    process.stdout.write(surf.makeImageSnapshot().encodeToBytes()); }
  ```
- **As a layer:** natively transparent PNG frames, so pipe them to ProRes 4444 or VP9-alpha.
- **Status:** installed, not render-tested.

---

## Processing and effect layers (they work on real footage)

### 13. SAM 2 subject cutouts (with rembg and MediaPipe as CPU fallbacks)

- **Repo:** https://github.com/facebookresearch/sam2 @ `2b90b9f` · **Install:** `/workspace/motion_engines/sam2/` (`venv/` with CPU PyTorch, `src/` editable at the pin, `checkpoints/sam2.1_hiera_tiny.pt`)
- **Best at:** click-or-box-prompted segmentation and **tracking one subject through a clip**: isolate a player, a rapper or a car, then put text behind them, pop them out of a frame, recolour the background, or put a spotlight on them.
- **Signature:** pro "subject pop" and text-behind-subject shots, the single biggest step towards broadcast or premium social polish.
- **CPU reality:** the tiny model on CPU is slow (seconds per frame). Use it for short shots (up to about 3–4 s, downscaled to 720p for masking), and draft on 10 frames first.
- **Recipe:**
  ```bash
  V=/workspace/motion_engines/sam2/venv/bin/python
  ffmpeg -i shot.mp4 -vf scale=-2:720 -q:v 2 frames/%05d.jpg           # SAM 2 reads a JPEG folder
  $V sam_track.py frames/ masks/ --point 540,700                       # script below
  ffmpeg -i shot.mp4 -framerate 30 -i masks/%05d.png -filter_complex "[1]scale=iw*1080/iw:-1,format=gray[m];[0][m]alphamerge" \
         -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le subject.mov
  ```
  ```python
  # sam_track.py
  import sys, os, numpy as np, torch; from PIL import Image; from sam2.build_sam import build_sam2_video_predictor
  src, out = sys.argv[1], sys.argv[2]; x, y = map(int, sys.argv[4].split(',')); os.makedirs(out, exist_ok=True)
  p = build_sam2_video_predictor('configs/sam2.1/sam2.1_hiera_t.yaml', '/workspace/motion_engines/sam2/checkpoints/sam2.1_hiera_tiny.pt', device='cpu')
  with torch.inference_mode():
      st = p.init_state(video_path=src); p.add_new_points_or_box(st, frame_idx=0, obj_id=1, points=np.array([[x, y]], np.float32), labels=np.array([1], np.int32))
      for i, ids, logits in p.propagate_in_video(st):
          Image.fromarray(((logits[0, 0] > 0).cpu().numpy() * 255).astype(np.uint8)).save(f'{out}/{i+1:05d}.png')
  ```
  Feather mask edges slightly (`gblur=sigma=1.5` on the matte) and look at an edge at 200%.
- **Fallback 1: rembg** (https://github.com/danielgatis/rembg @ `991927b`). Install: `/workspace/motion_engines/rembg/venv`, models in `/workspace/motion_engines/rembg/models` (u2net, u2net_human_seg, isnet-general-use). Per-frame salient-object cutout, much faster, no prompt.
  `U2NET_HOME=/workspace/motion_engines/rembg/models /workspace/motion_engines/rembg/venv/bin/rembg p -m u2net_human_seg frames/ cut/` writes RGBA PNGs, then `ffmpeg -framerate 30 -i cut/%05d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le subject.mov`. Edges can flicker between frames, so check the motion strip.
- **Fallback 2: MediaPipe** (https://github.com/google-ai-edge/mediapipe @ `40a1ecc`, pip wheel). Install: `/workspace/motion_engines/mediapipe/venv`, models `models/selfie_segmenter.tflite` and `selfie_multiclass_256x256.tflite`. Real-time CPU person segmentation (and hair, skin and clothes classes). Best for people in interviews or press clips. Use the Tasks API `ImageSegmenter` in `VIDEO` mode, write masks, then `alphamerge` as above.
- **As a layer:** the cutout is the `subject` layer, above the type layer and below the FX layer.
- **Status:** installed, not render-tested (SAM 2, rembg and MediaPipe alike).

### 14. OpenCV tracking and optical flow

- **Repo:** https://github.com/opencv/opencv-python @ `56b7342` (wheel `opencv-contrib-python-headless`; core https://github.com/opencv/opencv @ `5d0660a`) · **Install:** `/workspace/motion_engines/opencv/venv`
- **Best at:** **motion-tracked graphics** (a name tag, arrow or ring that follows a player: CSRT/KCF trackers give a per-frame box), stabilising shaky phone footage, optical flow (Farneback/DIS) for flow-driven smears, speed-ramp interpolation and datamosh-style looks, scene-cut detection when finding plays inside footage.
- **Output:** `track.json` (`[{f, x, y, w, h}]`). Remotion, GSAP or Skia layers read it to pin graphics to the subject.
- **Recipe:**
  ```python
  import cv2, json; cap = cv2.VideoCapture('shot.mp4'); ok, f = cap.read(); trk = cv2.TrackerCSRT_create(); trk.init(f, (x, y, w, h)); out = []
  i = 0
  while ok: ok2, b = trk.update(f); out.append({'f': i, 'x': b[0], 'y': b[1], 'w': b[2], 'h': b[3], 'ok': ok2}); ok, f = cap.read(); i += 1
  json.dump(out, open('track.json', 'w'))
  ```
  Smooth the track (moving average) before driving graphics. Check frames where `ok` is false.
- **Status:** installed, not render-tested.

### 15. Natron (node compositor)

- **Repo:** https://github.com/NatronGitHub/Natron @ `db3908d` (default branch RB-2.6; installed binary = release v2.5.0 portable) · **Install:** `/workspace/motion_engines/natron/Natron-2.5.0-Linux-x86_64-no-installer/`. Run it through the wrapper `/workspace/motion_engines/natron/natron-renderer`, which adds the `libGLU.so.1` the box lacks (from conda-forge, in `natron/extra_lib/`).
- **Best at:** Nuke-style node comps: keying, roto, planar tracking, grain matching, multi-layer merges.
- **Headless:** `/workspace/motion_engines/natron/natron-renderer -w Write1 1-90 comp.ntp` or `… natron-renderer comp.py` (a Python script that builds the graph). **It is not proven headless on this box yet.** If `NatronRenderer` fails without a display, or is slower than the alternative, use FFmpeg filtergraphs (16) for comps and grading and OpenCV (14) for tracking. They cover almost everything a 30–120 s film needs.
- **Status:** installed, not render-tested (headless not confirmed).

### 16. FFmpeg filtergraph effects

- **Repo:** https://github.com/FFmpeg/FFmpeg @ `e47940a` (pin noted; the box runs system `ffmpeg 7.1.5` at `/usr/bin/ffmpeg`, so there is nothing to install)
- **Best at:** finishing and editorial effects on real footage, fast on CPU. Recipes (append to a `-filter_complex`):
  - **Split screen / grid:** `[0][1]hstack`, `vstack`, `xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0`
  - **Speed ramp:** `setpts='if(lt(T,1),PTS,if(lt(T,1.6),PTS*3,PTS))'` (slow-mo window). Add `minterpolate=fps=60:mi_mode=mci` before it for smooth slow motion (slow on CPU; short shots only).
  - **Grade:** `lut3d=look.cube`, `curves=preset=strong_contrast`, `eq=saturation=1.2:contrast=1.08`, `colorbalance=rs=.05:bs=-.05`, `colorchannelmixer` for bleach-bypass or duotone
  - **Film texture:** `noise=alls=6:allf=t` (light grain, per frame), `vignette=PI/5`, `gblur` halation via `split,gblur,blend=all_mode=screen:all_opacity=0.25`
  - **Glitch / analogue:** `rgbashift=rh=6:bv=-6`, `chromashift`, `tblend=all_mode=difference`, `lagfun`, scanlines via `geq`
  - **Transitions:** `xfade=transition=<fade|wipeleft|slideup|circleopen|pixelize|radial|zoomin|hblur|…>:duration=0.33:offset=<s>`, and `blend` with a light-leak plate (`all_mode=screen`)
  - **Push-ins:** `zoompan=z='min(zoom+0.0015,1.2)':d=1:s=1080x1920:fps=30` on photos (render at 2× and scale down to avoid jitter)
  - **Compositing:** `overlay`, `alphamerge`, `colorkey`/`chromakey`, `maskedmerge`
- **As a layer:** this is the universal compositor and finisher for every other engine (0b above).
- **Status:** system binary present; the recipes are documented, not render-tested.

### 17. Generated motion: the Replicate gateway (note only)

`REPLICATE_API_TOKEN` is in `/workspace/secrets/motion_production.env` (load it with the SKILL.md "API keys" line; never print it, and pass it to curl through a header file, never on the command line). Use it only for a shot that **genuinely needs generated motion** that no real media or code engine can supply: an abstract transition plate, a stylised background loop, or an establishing atmosphere. It is a paid call, so plan it in `log/job.md` with an estimated cost first, and make at most 2 attempts (SKILL.md "Money"). Never present a generated shot as real footage of a real event or person. No Replicate client is installed; the HTTP API with curl is enough.

---

## Engine pool by job: always more than one strong choice

Use this to find **alternatives** when the ledger shows the first choice was used recently.

| Need | Strong options (all are good; rotate) |
|---|---|
| Documentary camera-through-a-world | Cinematic Skill · Three.js+Theatre (photo planes in depth) · Revideo (masked footage walls) |
| Typography / titles / captions | GSAP+SVG (split, scramble, draw) · Remotion · HyperFrames · Skia (variable-font weight motion) · Motion Canvas/Revideo · Three.js (extruded 3D type) |
| Stats, scores, box scores, charts | D3+GSAP · HyperFrames · Manim · Revideo counters · Skia |
| Maps and travel | MapLibre+deck.gl (real 3D map flights, arcs) · Cinematic `GeoMap` (paper map) · D3-geo (flat editorial projection) |
| Backgrounds and texture | PixiJS particles and filters · p5 flow fields and halftone · Skia SkSL shaders · FFmpeg grain and light leaks |
| 3D | Open 3D Skills (environments) · Three.js+Theatre (motion-design 3D) |
| Footage treatment | SAM 2 / rembg / MediaPipe cutouts · OpenCV-tracked callouts · FFmpeg grade, ramps, split screens |
| Accents (icons, bursts, underlines) | Lottie/dotLottie · Rive · GSAP DrawSVG · PixiJS bursts |
| Product / app / ad | Dolly · Three.js+Theatre · Remotion |
| Explainers / how-it-works | Manim · Motion Canvas/Revideo · Open 3D `exploded-view` |

---

## Visual DNA menu (starting points, never templates)

Pick an archetype as a **starting point**, then change at least three of its axes to suit the story. Never reuse the exact combination from a recent ledger entry.

| Archetype | Type system | Colour | Graphic style / texture | Transitions and pacing |
|---|---|---|---|---|
| Sports broadcast | Condensed or extended grotesk, tabular figures (Barlow Condensed, Oswald, Saira, Archivo Expanded) | Team colours plus one neutral | Score bugs, slashes, angular plates, motion-tracked rings | Fast wipes, whip pans, beat cuts |
| Gritty editorial collage | Mixed: stencil, typewriter, ransom-cut (Special Elite, Saira Stencil, Courier Prime) | Desaturated plus one hot accent | Torn paper, halftone (p5), tape, photocopy grain | Stop-motion jumps, paper slides |
| Luxury commercial | High-contrast serif or thin sans, wide tracking (Cormorant, Bodoni Moda, Jost Light) | Black, cream, one metal | Slow light sweeps (real 3D light), soft DOF | Long dissolves, slow push-ins |
| Retro / analog glitch | Pixel, VHS or 80s display (VT323, Press Start 2P, Monoton) | RGB split, magenta/cyan | Scanlines, rgbashift, tracking noise | Glitch cuts, datamosh, tape stops |
| Swiss minimal | Neo-grotesk, strict grid, big numerals (Inter Tight, Space Grotesk) | White, black, one primary | Grid lines, flat blocks, no texture | Hard cuts, sliding panels |
| Magazine | Display serif plus clean sans (Playfair Display, DM Serif Display, Fraunces with Inter) | Paper tone plus photo colour | Cover layouts, pull quotes, drop caps | Page turns, masked reveals |
| Archival newspaper | Old-style serif and blackletter headings (Libre Caslon, UnifrakturMaguntia, Old Standard TT) | Sepia or B&W | Newsprint halftone, column rules, clipping edges | Clipping drops, iris, slow pans |
| Neon / kinetic | Rounded or geometric display, outline-to-fill (Unbounded, Syne, Righteous) | Dark field, saturated glow | PixiJS glow, bloom, particles | Beat-synced flashes, zoom punches |
| Data-noir / investigative | Mono plus condensed (JetBrains Mono, IBM Plex Mono with Bebas Neue) | Near-black, red marks | Redaction bars, scan lines, document UI | Typewriter reveals, scramble decode |
| Street / hip-hop zine | Heavy brush or marker plus bold grotesk (Permanent Marker, Anton, Archivo Black) | Spray colours over B&W photo | Spray, stickers, scribbles (Lottie, p5) | Stutter cuts, rewinds, freeze frames |

**Type treatments to rotate:** masked line reveal · per-character stagger · scramble/decode · typewriter · outline-then-fill · variable-weight morph · stacked condensed lockup · text behind subject (SAM) · kinetic path text · highlighter or underline draw · 3D extruded · split-flap · counter digits. Fonts: download real files (Google Fonts via `github.com/google/fonts` raw files, or `@remotion/google-fonts`) into `assets/fonts/`. Record the family and file in `visualDna`.
