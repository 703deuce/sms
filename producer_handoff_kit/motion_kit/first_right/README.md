# first_right — right the first time (SKILL.md Stage 4c, Stage 5 steps 8–9, qa.md §2 / items 7, 7a)

The point: catch framing, scale, text collisions and timing **while building**, so the first stills Rick sees are
already clean, and a fix is re-checked only around the fix. This is a toolkit for checking the work. It doesn't render anything, and nothing here writes video.

| Step (Stage 4c) | Tool |
|---|---|
| 1 Tested pieces | `components/ms-pieces.js` (DOM + canvas), `components/ms-core.js` (math), `components/layer-scene.mjs` (layer-scene adapter + fitter) |
| 2 Layout math before drawing | `layout.mjs` → `design/layout.json` |
| 3 Faces placed by detection | `face_frame.py` |
| 4 Self-check while building | `scene_lint.mjs` (+ `lint/probe.js`, injected) |
| 5–7 Re-check only around a fix | `scene_lint.mjs --times` / `--scene` (one scene, its change points) |
| 8 Add a check | see "Adding a check" below |

Requirements on the box (already present): Node 20+, `/usr/bin/google-chrome`, puppeteer-core in
`/workspace/motion_engines/_capture/node_modules` (override with `MS_PUPPETEER=/path/to/puppeteer-core`, `MS_CHROME=`),
system `python3` with OpenCV ≥ 4.8 (`cv2.FaceDetectorYN`). The YuNet face model lives in `models/` (with its sha256 in `models/SHA256SUMS`). Everything runs on the CPU and nothing uses the network.

## Rules the tools enforce (one source: `components/ms-core.js`)
- **Readable floor**: cap height ≥ 40 px at 1080p, scaled by `min(W,H)/1080` (so 17.8 px at 480p and 40 px at 1080×1920).
  For 9:16 captions, the line height must be ≥ 75/1920 × H.
- **Safe area**:
  - 9:16 uses the universal social box: x 120–888, y 288–1248 at 1080×1920, scaled. Below y 780 the right edge moves in to x 780 (the UI rail).
  - Every other aspect uses 90% title-safe.
  - Full-bleed backgrounds/plates are exempt.
- **Contrast**: WCAG 4.5:1, or 3:1 for large text (cap ≥ 1.5× floor). The lint hides the text and measures it against the 10th-percentile background pixel inside the ink box.
- **Hits**: a hit lands 0 to +200 ms after its word. Anything later than +200 ms fails (HIT_LATE). That is stricter than qa.md's +300 ms fail line on purpose, so a hit only passes when it is inside the target window. More than one frame before the word warns (HIT_BEFORE_WORD); more than 200 ms before fails (HIT_EARLY). Thresholds: `--hit-late`, `--hit-early` (ms).
- **Faces**:
  - The eye line sits on the upper third, and the face is centred in x. Tolerance is ±0.08 of the box on each axis.
  - The crop keeps the forehead (0.15 × face height) and the chin (0.05 × face height) in frame.
  - Face height is at most 0.6 of the box, and the image is never upscaled more than 1.5×.
- **Overlap**: two layers may overlap only with `allowOverlap: [{with, reason}]`; a missing reason is an error.

## 1. Pieces — `components/`
No fixed look. Font, colour, size range, plate and spacing are **required** inputs from `design/system.md`. A piece:
- sits in a slot box from `layout.json`, and throws if the slot leaves the safe area (pass `clampToSafe: true` to clamp instead);
- auto-fits by shrinking within `style.sizeRange` or wrapping to the planned line count;
- **never shrinks past readable**: if the text can't fit, it throws `MSFitError` with
  `TEXT_DOES_NOT_FIT` ("shorten the line or widen the box"), or `SIZE_RANGE_BELOW_READABLE` when the design range itself is too small;
- registers itself with the lint hook.

```js
import { title, label, caption, numberCallout, lowerThird, mediaBox, fitForCanvas, drawFitted, lint as MSLint } from '…/first_right/components/ms-pieces.js';
globalThis.__msFrame = { W: 1080, H: 1920 };
title(stage, { id: 'title', box: L.title.box, text: 'TEXAS WENT BLUE', lines: 2, style: { font: { family: 'Anton', weight: 400, lineHeight: 1 }, color: '#F4EFE6', sizeRange: [90, 190] } });
mediaBox(stage, { id: 'photo', box: L.photo.box, media: img, framing: await (await fetch('photo_framing.json')).json(), faces: 1 });  // crop from face_frame.py
const fit = fitForCanvas({ id: 'm', text: 'D +2.1', box, style });  drawFitted(ctx, fit, box, style);  // PixiJS / three.js texture text
MSLint.install();                       // after the pieces are created
```
`ms-core.js` is a classic script (`<script src>` → `globalThis.MSCore`, or `require`), so engines without ES modules can use it too.
A full working example lives in `tests/pieces_demo/` (DOM pieces, plus canvas text, plus a photo framed by face_frame).

**Layer-scene (transovo.layer-scene/1) films**:
- `piecesToLayers(layout, sceneId, content, style)` builds the layer dicts in their slots, with timing from the word anchors.
- `node components/layer-scene.mjs fit spec.json --fonts display=/path/Anton.ttf,label=/path/DMMono.ttf --out fitted.json` fits every text layer in the same Chrome engine with the real font files. It sets `text.fontSize` to the fitted size and `text.minSize` to the readable floor, so the runtime's own 2 px auto-fit can never go unreadable. It exits 1 with the list of lines that need shortening.
- Nothing here edits the runtime or the writer: `tests/build_fixture.mjs` shows the chain plan → layout → face_frame → pieces → fit → writeLayeredScene.

## 2. Layout math — `layout.mjs`
```
node layout.mjs --plan design/plan.json --words audio/words.json --grid design/grid.json [--size 1080x1920] [--out design/layout.json] [--write-anyway]
```
- **`grid.json`** (from design/system.md):
  - `base {w,h}`, `columns`, `rows`, `gutter`, `margin: "safe"|px`;
  - `capRatio` (cap/em of the design's text font; **set it per font**, e.g. Anton ≈ 0.86, DM Mono ≈ 0.70);
  - `lineHeight`, `fullBleed: [slot…]`;
  - `areas: {name: {col:[a,b], row:[a,b]}}`, or an explicit `box`.
- **`plan.json`**:
  - `size`, `fps`, `scenes: [{sceneId, offsetMs, durationMs, layers: [...]}]`;
  - each layer is `{id, kind, slot, text?, lines?, faces?, in, out?, hit?, allowOverlap?: [{with, reason}]}`;
  - `in`/`out`/`hit` take a word ref: `"L1:flipped"`, `"L1:fifty-six#2"` (2nd occurrence), `"L1:flipped@end"`, `{ms: 1234}`, `"start"`, or `"end"`.
- **Output**: per layer, `box` (output px), `window` (scene-local ms), `film` window, and `hit {word, filmMs, expectMs, toleranceMs:200}`.
- **Rejects** (exit 1, writes nothing):
  - text slot outside the safe area;
  - slot too short for its lines at the floor;
  - same-time slot overlap without `allowOverlap` + reason;
  - `allowOverlap` without a reason.
- **Warns** when the text width estimate looks tight. (Estimates aren't fits: the pieces/fit tool decide for real.)

## 3. Faces — `face_frame.py`
```
python3 face_frame.py clip.mp4 --box 480x600 [--fill medium] [--start 3 --end 9] [--face largest|left|right|center] [--follow] --out framing.json
python3 face_frame.py photo.jpg --box 560x723 --face right --out photo_framing.json [--emit-crop photo_560x723.jpg]
python3 face_frame.py check framed.png [--json]
```
- The tool finds shot cuts (histogram or luma jump), samples each shot, tracks faces, and gives one steady crop per shot (`--follow` gives a smoothed path instead).
- Output, per shot:
  - `crop {x,y,w,h}` in source px;
  - `css` (object-fit/position/transform);
  - an ffmpeg `crop,scale` filter;
  - `placed` (where the eyes/centre land in the box), `upscale`;
  - `warnings` (e.g. UPSCALE_HIGH, FACE_CUT_FOREHEAD);
  - `noFace: [{t0,t1}]` for the parts with no face.
- Exit codes: 1 when an expected face is missing or can't be centred, 2 for usage errors.
- `--emit-crop` writes the framed still, ready for a layer-scene image layer.

## 4. Self-check — `scene_lint.mjs`
```
node scene_lint.mjs <sceneDir|index.html> [--layout design/layout.json --scene S1 | --film] [--size WxH] [--json report.json] [--quiet]
     [--times 1.2,1.5] [--dense 250] [--query k=v] [--root DIR] [--host host.json] [--no-contrast] [--no-faces]
     [--overlay 1.467 --overlay-out /tmp/x.png]      # debug only: one PNG with every measured box drawn
```
- **Exit codes**: 0 pass (warnings allowed), 1 fail, 2 setup error (page error, no hook, bad args).
- **Output**: a human summary on stdout and JSON with `--json`.
- **No video, no saved screenshots.** In-memory pixel reads are used only for the contrast and face checks (`--no-contrast/--no-faces` skip them).
- **How it works**:
  - It serves the scene dir statically, with `/ms/*.js` falling back to the producer runtime, and builds the host payload from `project.live.json` when one is found.
  - It seeks to every **change point**, the midpoint between change points, each planned window, and each hit.
  - It reads layers from `window.__msLint`. Layer-scene pages need no hook, since the probe has a built-in adapter for `[data-layer]` + `layers.json`.
- **"Settled"**: layout checks run only on samples where a layer is at full size, opaque and not moving vs the next sample. Entrances, whips and pops are not judged mid-motion. Collisions are judged on every visible sample, though.

| Code | Fails when |
|---|---|
| TEXT_OVERFLOW | text ink/content is bigger than its fit box (>1 px) |
| TEXT_CLIPPED | an ancestor with overflow hidden or clip-path cuts the ink |
| OUTSIDE_SAFE_AREA | ink leaves the safe box (unless full-bleed/background) |
| CAP_TOO_SMALL | measured cap height < floor (9:16 captions: also line height) |
| COLLISION | ink/box intersects another visible layer. Polygons are used for projected 3D quads. Plates, a panel fully containing the text, backgrounds and `allowOverlap` pairs are excluded |
| CONTRAST_LOW | 10th-percentile background contrast < 4.5 (3 for large text). Skipped for layers already colliding |
| MISSING_LAYER / LAYER_NOT_VISIBLE / BLANK_LAYER | a planned layer is absent, never visible in its window, or visible but empty |
| TEXT_MISMATCH | on-screen text ≠ planned text (normalized). Catches edits that change facts or overflow |
| MEDIA_MISSING / MEDIA_BLANK | planned media not loaded / flat pixels |
| OFF_SLOT | settled box has IoU < 0.5 with its layout.json slot and its centre is > 5% of the frame diagonal away |
| HIT_LATE / HIT_EARLY | first visible time (binary search to 1 frame, bounded by the window) is more than 200 ms after / before the word |
| FACE_NOT_FOUND / FACE_OFF_CENTRE | for layers planned with `faces`: the YuNet face (nearest the centre among the big ones; the group when ≥ 2) is off the eye-line/x rule |
| warnings | UNPLANNED_LAYER, HIT_BEFORE_WORD, EXTRA_FACE, FEWER_FACES, NO_SAMPLE_IN_WINDOW; CONTRAST_LOW is only a warning (marked "approximate") for canvas text whose scene gives no `hide()` |

**Re-check only around a fix (Stage 4c steps 5–7)**: after fixing S3's caption, run
`node scene_lint.mjs preview/scenes/S3 --layout design/layout.json --scene S3`, or narrow it further with `--times 2.1,2.3`. Then take stills of only that scene's change points, and re-check other scenes only if the shared design/system changed.

### Exposing the hook
- **Layer-scene runtime (`ms-layers.js`)**: built in, so there's nothing to add.
- **Pieces (`ms-pieces.js`)**: pieces register themselves. Call `MSLint.changePoints(fn)` and `MSLint.install()`.
- **Custom DOM / GSAP**: mark each layer element with `data-layer="id"` and `data-kind="text"`, then:
```js
window.__msLint = { version: 1,
  changePoints: () => tl.getChildren().flatMap(c => [c.startTime(), c.endTime()]),
  layers: () => [...document.querySelectorAll('[data-layer]')].map(el => ({ id: el.dataset.layer, kind: el.dataset.kind, el })) };
```
- **three.js** (the working example is `tests/gold/scenes/world/world.js`, end of file). Add a box or a projected quad per object, and DOM text as above:
```js
const quad = m => { camera.updateMatrixWorld(); m.updateWorldMatrix(true, false);      // REQUIRED: the lint may seek without rendering
  m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox, v = new THREE.Vector3();
  return [[b.min.x,b.min.y],[b.max.x,b.min.y],[b.max.x,b.max.y],[b.min.x,b.max.y]].map(([x,y]) => { v.set(x,y,b.max.z).applyMatrix4(m.matrixWorld).project(camera); return [(v.x+1)/2*W, (1-v.y)/2*H]; }); };
window.__msLint = { version: 1, changePoints: () => CUTS, layers: () => [
  { id: 'print_a', kind: 'media', poly: quad(printMesh) },               // or box: MSLint.projectBox(THREE, obj, camera, W, H)
  ...domTextLayers() ] };
window.__scene.seek = async t => { if (window.__msLintGeometryOnly) pose(t); else render(t); };   // optional speed-up
```
  `window.__msLintGeometryOnly` is true while the lint only needs geometry. A heavy renderer (e.g. Gold's 6-sub-frame shutter) can just pose objects then, which cut the Gold lint from 104 s to 16 s. Pixel checks always seek with it false.
- **PixiJS**: `{ id, kind: 'text', box: MSLint.pixiBox(textObj), opacity: textObj.worldAlpha, text: { value: textObj.text, color, fontPx, family } }`.
  For canvas-drawn text, also give `hide(id, hidden)` so contrast can sample the background; otherwise contrast is only a warning.

## 5. Adding a check (Stage 4c step 8)
When review finds something the lint missed:
1. Add a block in `scene_lint.mjs` after `// ---- findings ----`. The data you have:
   - `snaps` (every sample: `{t, layers}`);
   - `tracks` (per layer id: `[{t, l}]`);
   - `settledAt.get(id).has(t)`;
   - `planned` / `plannedById` (layout.json in page time);
   - `W`, `H`, `FLOOR`.

   Call `fail(CODE, layerId, t, 'one line that says what to change')` or `warn(...)`; repeats are counted per code+layer. For pixel checks, follow the contrast/face blocks (seek with `__msLintGeometryOnly=false`, clip a screenshot to the box in memory).
2. If it needs new data from the page, add the field in `lint/probe.js` → `collect()` (and to the hook protocol in `components/ms-lint-hook.js`).
3. Add a test in `tests/run_tests.mjs`: inject the defect into a copy of a fixture scene (see `tests/build_fixture.mjs` / `tests/midterms/make_plan.py`), assert the new code fires on the injected layer and **does not** fire on the clean fixture.
4. Note the case in the skill's qa.md list (the owner edits skill files).

## Tests
```
cd /workspace/motion_kit/first_right && node tests/run_tests.mjs     # ~100 s; writes tests/results/{*.json,*.txt,SUMMARY.md}
```
The suite runs:
- unit checks for the planner's overlap rules;
- the planner on the Gold and midterms plans;
- face_frame on a photo and a clip;
- the fixture chain plan → layout → pieces → fit → layer-scene;
- the lint on a clean fixture, injected overflow/collision/off-centre face/late hit, every midterms scene (+ injected overflow, shrink-below-readable, collision, late hit), the Gold three.js scene (+ injected late hit), and the pieces demo.

## Known limits
- **Contrast**:
  - It is measured against the background with the text hidden. For canvas text without `hide()`, it is approximate and only a warning.
  - With text-on-video, the plate is sampled at the change points only.
- **Ink boxes** come from font metrics (ascent/descent of the actual glyph run). They are tight for caps; mixed-case descenders are counted as ink.
- **Moving text**: continuously moving text (e.g. a crawl that never settles) is layout-checked only at its last sample. Collisions are checked at every sample.
- **Faces**: only boxes planned with `faces` are checked. Faces baked into a full-frame plate image aren't checked against a slot.
- **The planner's height check** uses `grid.capRatio`. Set it from the real font, or it will be too strict/lenient (the fitter measures the real font and is authoritative).
