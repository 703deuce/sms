# Motion Studio customer-editable elements: contract proposal v0.1

**Status:** this is a proposal for review by Rick, ChatGPT and the Transovo editor team. It is not a final spec. It was built around one real scene and has been tested on that scene only. Nothing in `703deuce/sms`, the production skill or the routine was changed.
**Owner split:** Transovo owns the editor UI and where edits are stored. Grokbot owns the producer export (the bundle and its manifest) and parameter rendering (`ms-props.js` and `render.mjs`).

---

## 0. The scene this is built on

**Film:** `keith_murray_doc_2min`, the finished 2-minute documentary (`/workspace/motion_tests/keith_murray_doc_2min/final/keith_murray_doc_2min.mp4`).
**Scene:** `S01`, the title card at 6.25 s to 11.82 s (167 frames, 1920×1080, 30 fps).

What the scene does: the camera glides over a 3D dictionary page (three.js, with a 4096×2560 canvas texture). The subject's entry on the page is highlighted, and his B&W photo print lies on the page. "KEITH MURRAY" types on letter by letter (GSAP SplitText). Then the pronunciation appears, followed by the place and the year, each timed to a narration word.

Why this scene:
- It is a real, browser-based title from a finished film.
- It mixes two engines: WebGL for the world and DOM/GSAP for the type. One scene therefore tests editable text in two layers: the DOM title, and text painted into a WebGL texture (the dictionary headword).
- It covers colours that reach WebGL lights and fog, and an image on a 3D mesh.
- It is the hardest "live preview" case Rick raised (three.js) while still being small.

The Phil Blount film's scenes are footage-plus-overlay, so they have no comparable animated title.

---

## 1. Principles

1. **Not a template system.** Grokbot keeps designing every scene from scratch. `editable-elements.json` is written *after* the scene exists. It describes which parts of *this* custom scene a customer can safely change, and nothing else. It defines no layout, no motion and no style. It is never used to generate another scene.
2. **The producer declares, the editor obeys.** Only properties listed in the manifest are editable. Everything else is protected by default.
3. **One bundle, two consumers.** The browser preview and the export worker load the *same* scene bundle, the same assets, fonts and runtime, and the *same* props resolver (`ms-props.js`). Section 7 covers parity.
4. **Assets by Transovo ID only.** No local paths or signed URLs are stored in a project. The host turns IDs into session URLs at load time.
5. **No AI in the edit loop.** Live and render edits are deterministic code paths. Only `ai_editable` changes go back to Grokbot.

---

## 2. Package layout (this POC)

```
project/theme.json                  project-wide design tokens + font catalog            (schema: schemas/theme.schema.json)
project/versions/v1.json            project version: pins theme version, scene bundles, per-scene overrides, runtime
bundle/S01/                         scene bundle = what preview and export both load (asset bnd_km_S01_v1)
  index.html, scene.js              the custom scene (animation code unchanged from production)
  ms-props.js                       props runtime: resolve -> validate -> apply; setProps/getProps/validate/describe
  editable-elements.json            this scene's manifest                                (schema: schemas/editable-elements.schema.json)
  bundle-lock.json                  sha256 of every bundle file + runtime versions
  lib/                              gsap 3.15.1 + SplitText, three r187, scene fonts, cues/words (unchanged copies)
assets/registry.json                stand-in for Transovo's asset store (id -> bytes); projects only hold the ids
variants/*.json                     customer edits as override patches                   (schema: schemas/scene-overrides.schema.json)
render.mjs                          deterministic render entry point (§8)
preview_test.mjs                    live-preview proof in headless Chromium (§9)
```

---

## 3. Tiers

| Tier | Meaning | Who executes | Cost |
|---|---|---|---|
| `live_editable` | Updates in the browser preview through `setProps`, with no server. | The editor (browser) for preview; the worker for export, using the same code | none until export |
| `render_editable` | No AI, but needs a worker step that the browser bundle does not do (a Python/ffmpeg op, face detection, grain). The preview shows the last worker result or a "pending render" badge. | A worker, deterministic | worker time only |
| `ai_editable` | A creative change: new layout, motion, concept, aspect ratio, or narration. Goes back to Grokbot as a revision job. | Grokbot | AI usage |
| `protected` | Never changeable by the customer: animation code, camera, motion paths, physics, layer logic, engine internals. | n/a | n/a |

### S01 classification

| Element (stable id) | Property | Tier | Notes |
|---|---|---|---|
| `title` (DOM) | `text` (≤2 lines, ≤14 chars/line, uppercase), `font` (→ `fonts.display`), `fontSize` (180–320 px, auto-fit down to 160), `color` (→ `colors.text`) | live | The reveal adapts naturally: 0.035 s stagger per character. |
| `pronunciation` (DOM) | `text` (≤32), `partOfSpeech` (≤6), `font` (→ `fonts.body`, needs an italic face), `color` (→ `colors.text` at 72%) | live | |
| `location` (DOM) | `text` (≤32, uppercase), `font` (→ `fonts.label`), `color` | live | `spokenInNarration`: the editor warns that the voice-over will not change. |
| `year` (DOM) | `text` (≤6), `font` (→ `fonts.display`), `color` (→ `colors.secondary`) | live | `spokenInNarration` |
| `headword` (WebGL texture) | `text` (≤24), `highlight` (→ `colors.accent`), `color` (→ `colors.background`) | live | Repaints the 4096×2560 texture; the highlight bar grows to fit. |
| `portrait` (WebGL mesh) | `image` (jpeg/png/webp, ≥480×360), `focalPoint` (cover-crop to 4:3), `borderColor` | live | |
| `portrait` | `grade` (`none` or `archive_bw_warm`) | **render** | The film's archive grade is a Python image op (`tools/grade_portrait.py`). The worker returns a derived asset, which is then live. |
| `portrait` | `autoFocalPoint` | **render** | Face detection (MediaPipe) runs on the worker, and the result is written back as a live `focalPoint`. Declared but not run in this POC. |
| scene | `render.grain` (0–10) | **render** | Film grain is an ffmpeg post step in this pipeline, not part of the browser bundle. |
| `logo` (DOM, producer slot) | `visible`, `image` (svg/png/webp; falls back to `theme.brand.logo`), `position` (`bottom-right`, `top-left`), `height` (48–110), `tint` (`original`, `text`, `accent`) | live | Off by default. See §11. |
| scene | aspect ratio / resolution, duration / retime, camera path, concept, reveal styles, adding elements, the narration itself | **ai** | The layout and WebGL buffer are authored for 1920×1080, and the timing is anchored to narration words. |
| scene | camera keys + Catmull-Rom path + easing, every GSAP tween and anchor, geometry, fog, key light, lamp flicker, vignette, text shadow, filler-word generator (seed 11), engine libs | **protected** | Listed in `protected[]` with file locations. |

---

## 4. Element and property model

Each element has:
- `id`: stable across revisions and never renumbered (`title`, `pronunciation`, `location`, `year`, `headword`, `portrait`, `logo`).
- `kind` and `layer`: `dom`, `svg`, `canvas2d`, `webgl-texture`, `webgl-mesh`, `video` or `audio`. This tells the editor how the element is hit-tested.
- `selector` and `timing`: `inSec`, `revealEndSec`, `outSec`, `anchor`, and `revealRule` where the length depends on the text.
- `layout`: `origin`, `fitBox`, and the safe positions for the logo.
- `contrast`, and `properties` with one schema per property. A property declares:
  - `tier` and `type` (`text`, `number`, `color`, `font`, `image`, `point`, `enum` or `boolean`)
  - `default` and/or `bind` (a theme token)
  - `min`/`max`/`autoFitMin`, `maxChars`/`maxCharsPerLine`/`maxLines`, `transform`, `overflow`, `enum`, `formats`, `minWidth`/`minHeight`
  - for render-tier properties, the `worker` and the reason (`why`)

Element-level `aiEditable[]` tells the editor what to offer as "Ask Grokbot to redesign…".

- **Selection bounds** are measured, not hand-written. `__scene.describe()` returns each element's box at the hold frame for the current props (for example the original title at `{x:120,y:210,w:948,h:516}`). The editor calls it after every `setProps`. For WebGL-layer elements (`headword`, `portrait`), the box is not yet exposed. See open question 3.
- **Safe area:** action-safe is 96/54 px and title-safe is 120/96 px. Fit boxes and logo positions are declared inside them.

---

## 5. Theme tokens and resolution

`theme.json` (project-wide) holds:
- `colors`: `background`, `primary`, `secondary`, `accent`, `text`. Each has a value, a label and its design name, for example `deep`, `pine`, `brick`, `lime`, `bone`.
- `fonts`: `display`, `label`, `body`, each as `{asset, weight}`.
- `brand.logo`
- `fontCatalog`: the only fonts the customer may pick, with faces and weight ranges.

**Resolution order (highest wins):**
1. element property override (`scenes.S01.elements.title.color`)
2. scene token override (`scenes.S01.tokens["colors.accent"]`)
3. project theme, including the project-wide theme patch (changing it re-themes every scene in the film at once)
4. manifest default

A `null` in a patch removes an override, so the property falls back to the next level.

**Derived tokens.** Some literals in a hand-designed scene are *shades of* a token rather than the token itself. In S01 the page gradient is `#143A2D`/`#0B2219`, derived from `primary #0E2A22`. The manifest records the design pair. When the source token is untouched, the exact original literal is used. When it changes, the same OKLCH lightness/chroma/hue offset is applied to the new value (`method: oklch-delta`). This is how the light "paper" theme in variant B gets a coherent page colour without anyone hand-picking it.

**Finding:** a literal that happens to equal a token is not necessarily that token. The print border was `#EFE7D6`, the same as `text`. Binding it to `colors.text` turned the photo border black in the light theme, so it is now its own `portrait.borderColor`. The producer must decide token binding on meaning, not on value.

---

## 6. Validation

There are two layers, and both run inside `ms-props.js`. The host can also run the schema-level checks without a browser.

| Code | Severity | Layer | Rule |
|---|---|---|---|
| `TYPE`, `ENUM`, `RANGE_CLAMPED` | error / error / warning | schema | type, enum and min/max (out-of-range values are clamped) |
| `TEXT_TOO_LONG`, `TEXT_LINES`, `TEXT_EMPTY` | error | schema | `maxChars`, `maxCharsPerLine`, `maxLines` |
| `FONT_NOT_ALLOWED`, `FONT_WEIGHT_MISSING` | error / warning | schema | the font must be in `fontCatalog`, and the weight must exist (no faux bold) |
| `ASSET_UNRESOLVED`, `ASSET_MISSING` | error | host | the asset ID can't be resolved, or the logo is visible with no asset |
| `TIER_NOT_LIVE` | error, and the patch is refused atomically | runtime | a render/AI-tier property sent through `setProps` |
| `AUTOFIT_APPLIED` | info | layout | the font shrinks in 2 px steps until the measured box fits `fitBox`, stopping at `autoFitMin` |
| `TEXT_OVERFLOW` | error | layout | still does not fit at the minimum size |
| `CONTRAST_LOW` | warning, or error below 2:1 | layout | WCAG ratio against the worst page tone behind the text. Threshold = min(spec minimum, **design baseline**) |
| `OVERLAP` | warning | layout | measured boxes of editable elements intersect, unless the pair is listed in `allowedOverlaps` |
| `IMAGE_UPSCALED` | warning | layout | the logo or portrait is shown larger than its source |
| `SPOKEN_TEXT_CHANGED` | info | schema | the text is also spoken in the narration |

- **Design baseline:** Grokbot's own year colour (brick on pine) is 2.61:1, which is below WCAG's 3:1. Without the baseline rule, the original film would fail its own validator. With it, the validator never flags the designer's intent, but it does catch customer edits that make text worse than the original.
- **Images:** an image is cover-cropped to the slot's aspect around `focalPoint`. A source that already matches the slot (480×360 at 4:3) is untouched.
- **SVG logos** must be outlined: no `<text>`, no external references, no scripts. Fonts inside an SVG `<img>` are not pinned and would break parity.
- **Errors** block export. The preview still shows the edit with a red marker.
- **Warnings** need user confirmation.

`variants/C_invalid.json` is a deliberate bad edit. It passes the JSON Schema (it is structurally valid) and is then rejected by the runtime with 10 errors (`out/C_invalid.report.json`).

---

## 7. Preview/export parity and the `livePreview` flag

- **Same scene bundle.** It is pinned by `bundle-lock.json` (sha256 per file) and loaded from the same asset ID by both the editor and the worker. The preview must never use a lighter or rewritten version of the scene.
- **Same assets and fonts.** Fonts are Transovo assets loaded with `FontFace` under unique aliases (`ms_<assetId>`), so a system font with the same name can never leak in.
- **Same resolver.** `ms-props.js` is inside the bundle. Transovo does not re-implement token resolution for rendering. It only writes override patches.
- **Same runtime versions.** gsap 3.15.1, three r187, Chrome 156 for export. The preview runs on the customer's browser and GPU, which is the one unavoidable difference. Parity is defined as visual equivalence, not bit-exactness (§10).
- **`livePreview.capability`:**
  - `live`: this scene. It needs WebGL1+, `MAX_TEXTURE_SIZE` ≥ 4096, about 4 GB device memory, the FontFace API and CSS mask.
  - `live_limited`: playable, but some properties only update on pause.
  - `render_only`: for example a heavy three.js scene, a scene that needs server-only engines (Manim, Natron, SAM2) or a footage-heavy composite.

  The flag records `reasons` and `requirements`. The editor checks the requirements on the device. If they fail, it shows `fallback.posterFrame` (frame 166 here) and queues a worker render of the same bundle with the same props.

---

## 8. Deterministic render entry point

```
node render.mjs --version project/versions/v1.json --scene S01 [--overrides edits.json] --out S01.mp4 [--report r.json] [--validate-only]
```

- **Inputs:** a project version (which pins the theme version, the bundle and the stored per-scene overrides), plus an optional override patch in the same shape the editor sends to `setProps`. No AI, no network, no paid calls.
- **Steps:**
  1. Run render-tier pre-steps; for example, `portrait.grade` produces a derived asset with a new ID.
  2. Resolve asset IDs to local session URLs.
  3. Load the bundle in headless Chrome (SwiftShader) with `window.__MS_HOST = {theme, overrides, assetUrls, mode:"render"}`.
  4. Refuse to render if validation has errors.
  5. Step frames by `seek(i/fps)`.
  6. Apply render-tier post steps (grain).
  7. Encode H.264 High, **level 4.2**, yuv420p, crf 16, at the scene's own 1920×1080 at 30 fps.
- **Outputs:** the clip, plus a report with:
  - the issues found
  - the resolved props
  - hold-frame bounds
  - the bundle hash, Chrome version and pre-steps

---

## 9. Live preview API (what the Transovo editor calls)

```js
// before the bundle loads (iframe):
window.__MS_HOST = { theme, overrides, assetUrls /* id -> session URL */, mode: 'live' };
// after window.__ready && window.__msReady:
await __scene.setProps({ theme: {...partial}, scenes: { S01: { tokens: {...}, elements: { title: { text: 'Def Squad\nKeith' } } } } });
// -> { ok, issues[], applyMs }. Merges, re-resolves, repaints, rebuilds the SAME tweens, re-seeks to the current time. No reload.
await __scene.seek(t);           // scrub; also used for frame export
__scene.getProps(); __scene.validate(); __scene.describe();   // resolved values, issues, element boxes
```

Under the hood, `setProps`:
1. reverts SplitText
2. clears the paused GSAP timeline
3. clears only the GSAP inline state
4. repaints the page texture (same seed) and swaps or crops the photo texture
5. updates lights and fog
6. re-runs the scene's own unchanged `CFG.type` tween code

Animation code is never regenerated.

---

## 10. Demo results (all on this box; paths under `/workspace/editable_contract_poc/`)

- **Original props vs the production clip.** `out/S01_original_props.mp4` against the production `scenes/S01/out/S01.mp4` scores SSIM 0.9955 and PSNR 47.7 dB, which is the level of difference re-encoding alone produces. Before encoding, I also compared lossless PNG frames from a fresh capture of the *untouched* production bundle against the parameterized one: the maximum channel difference is 2/255, on at most 0.30% of pixels, and only along the title/pronunciation text edges. Visually they are identical.
- **Run-to-run determinism.** Two renders with the same inputs differ by ±1/255 on at most about 0.006% of pixels. This is anti-aliasing noise from Chrome/SwiftShader text. Output is visually deterministic, but not bit-exact. See open question 7.
- **Motion unchanged** (`out/preview/preview_log.json`):
  - The camera position and orientation trace over all 167 frames is **identical** for original, A and B.
  - Every non-title tween is **identical**: same start, duration, ease and anchor. The logo adds one tween, on the existing location cue at 1.53 s.
  - The title tween keeps start 0.07 s, stagger 0.035 s and ease `expo.out`. Only the character count changes the length: 11 chars → 0.80 s, 10 → 0.765 s, 16 → 0.975 s.
- **Variants.** All variants passed validation with no errors. The text fits in all of them: auto-fit ran where needed and no text overflows.
  - `out/S01_variant_A.mp4`:
    - midnight/gold palette (film-wide theme patch)
    - Playfair Display 900 and Archivo 700
    - title "THE / LEXICON" (auto-fit 300 → 204 px)
    - new headword and pronunciation
    - SVG logo bottom-right
  - `out/S01_variant_B.mp4`:
    - light paper palette, plus a scene-level accent override
    - Anton title "LONG ISLAND / LEGEND" (auto-fit 300 → 202 px)
    - PNG logo top-left, tinted to the text colour
    - render-tier portrait grade and grain 5

    The validator first flagged the headword at 1.94:1 contrast on the blue highlight. The edit fixed it by setting the headword colour.
- **Side by side.** `out/contact_sheet_S01.png` shows the same 6 frames (3, 15, 30, 60, 114, 166) for production, original props, A and B. `out/comparison_S01.mp4` is a 2×2 grid, 1920×1080, H.264 High level 4.2.
- **Live in the browser.** See `out/preview/preview_evidence.png` and the PNGs in that folder.
  - One document request for the whole session, and the load token never changed.
  - `setProps` applied in 9–48 ms on headless software GL; the texture upload happens on the next frame.
  - A `portrait.grade` patch was refused atomically with `TIER_NOT_LIVE`.
  - After all edits, resetting to the original props gave a pixel-identical frame.
  - Preview frame vs export frame at t = 4.0 s: SSIM 0.9945 (original) and 0.9935 (variant A), which is codec-level.
- **Render speed.** A 167-frame clip takes about 60–85 s on this box's software GL.
- **Variant B file size.** B is 55 MB because grain at crf 16 is expensive. In the real pipeline grain stays a master-level step.

---

## 11. What changed versus the production scene

See the diffs against `bundle/S01/index.original.html` and `scene.original.js`.

- **Literals moved to props:** colours, strings, font families and the photo source now come from props. The camera, path, easing, geometry, lights setup and every tween are byte-identical, and `CFG.type` is untouched.
- **Content painting wrapped for repaint:** the page-painting code is wrapped in `paintPage(P)` so it can repaint. It uses the same seed, so the same filler words come out.
- **QA hook added:** a read-only `__msTrace()` hook.
- **Logo slot added.** The original film has no logo, so this is a **producer-declared slot** (`producerSlot: true`). It is off by default, so the original render is unaffected. It reuses the scene's existing `S.show` reveal on the location cue. Proposed rule: from now on Grokbot designs a logo slot into title and end scenes at production time, rather than letting the editor drop a logo anywhere.

---

## 12. Open questions for Transovo's editor team

1. **Hosting model.** Can the editor load a scene bundle in a sandboxed iframe (`sandbox="allow-scripts"`, CSP with no outbound network), inject `__MS_HOST` and talk via `postMessage`? Or does it have to be in-page?
2. **Asset resolution.** Can the editor mint short-lived session URLs per asset ID, for the iframe and the worker alike, so nothing signed is ever stored? Which ID format should we use: `ast_`/`fnt_`/`bnd_` or Transovo's own?
3. **Selection on WebGL elements.** For `headword` and `portrait`, should the bundle return projected 2D boxes per frame (we can compute them from the camera), or is a panel-only edit (no on-canvas selection) acceptable for v1?
4. **Where edits are stored.** Is the override patch (`scene-overrides/0.1`) stored per project version, with "Export" snapshotting it into a new project version? And does a project-wide theme edit create a new `themeVersion`?
5. **Timeline integration.** Does the existing ClipEditsV2 timeline mount one iframe per scene clip while scrubbing, or should we provide poster/proxy MP4s for scrubbing and go live only on the selected scene?
6. **Render-tier UX.** When a customer picks a render-editable property (grade, grain, auto focal point), what should the preview show: a "pending render" badge over the old look, or a worker preview of a single frame?
7. **Parity tolerance.** Is "visually identical, at most ±2/255 on text edges" acceptable for preview vs export, or does the editor need bit-exact frames? If so, we would need a pinned headless Chrome for previews too.
8. **Device requirements.** Is the `livePreview.requirements` check (WebGL, texture size, memory) enough on your side, or do you want a measured frame-time probe in the bundle?
9. **Fonts.** Is a project `fontCatalog` OK, or does Transovo have a global licensed font library we should reference by ID instead? Customer-uploaded fonts would need glyph-coverage validation, for example of the IPA characters in the pronunciation line.
10. **Narration-linked text.** When the customer changes `location`, which is spoken in the narration, should the editor offer an `ai_editable` "re-voice this line" action?
11. **Undo and history.** Patches with `null` deletes are enough for undo, but do you need per-edit history from us?

## 13. Not done (deliberately)

- **One scene, one engine mix.** No all-engine spec. PixiJS, Skia and Python-rendered scenes will need their own `livePreview` and layer notes when we do them.
- **Not wired to Transovo.** No changes to production code, the skill, the routine or the repo. No uploads, no paid calls.
- **`autoFocalPoint` (face detection) is declared but not executed** in this POC.
