# Motion Studio multi-engine expansion plan

Status: **prepared, not started, not integrated.**  
This document is the next expansion phase after the current Cinematic Skill Motion Studio pipeline is completed and validated. It must not be merged into the Transovo product or the SMS repo until that gate is passed.

Isolated clones live under `/workspace/engines/`. The existing Cinematic Skill checkout was **not** re-cloned here: it is already in the kit at `/workspace/motion_kit/code_motion_cinematic/repo` and already vendored in the product at `worker/clips_worker/motion_studio/vendor` (commit `bf43556`). Nothing in this phase touches `/workspace/sms*`, the SMS repository, or any server.

Prepared: 15 November 2026, America/New_York.

---

## Architecture

Five professional motion-design toolkits. One AI Director. One Transovo video-production pipeline.

- Each system is a **separate creative engine**, kept in its own isolated directory and (later) its own sandbox. They are never merged into one giant codebase.
- They are **not interchangeable**. They must not be forced to share one aesthetic. They must not be reduced to collections of fixed templates.
- Custom animation code stays first-class in every engine. The Director and the per-video generator write new scene code with that engine's own capabilities, the way the current Cinematic Skill generator writes a fresh `scene.py` / `ext.py` world for each film.
- The Director chooses the engine that fits the user's video — or combines rendered scenes from more than one engine — according to what looks best, not according to which engine has the longest feature list.
- Each engine delivers finished video scenes to **Transovo's shared timeline** (the existing Compact Editor timeline). A later film can mix, for example, a Cinematic Skill documentary world, a Dolly product-demo shot, and a Remotion kinetic-type open, under one art direction.
- Intended coverage once all five are proven: documentaries, explainers, SaaS demos, tutorials, product advertisements, data stories, and highly polished social videos. Each project should have its own professional visual identity.

```
User idea
    → AI Director (picks or combines engines, holds art direction)
        → Cinematic Skill     ↘
        → Dolly               →  rendered scenes (MP4 / clips)
        → HyperFrames         →  into the shared Transovo timeline
        → Open 3D Skills      ↗
        → Claude Remotion Skill
```

Until the current Cinematic Skill Motion Studio is completed and validated, this folder is documentation and isolated study material only.

---

## License decision (recorded)

Rick confirms Transovo is a **one-person company**. No paid license is needed for any of the five engines, Remotion included.

- Cinematic Skill, Dolly (the skill/repo itself), Open 3D Skills, and the Claude Remotion Skill are MIT.
- HyperFrames is Apache 2.0, with no per-render fees or commercial-use thresholds.
- Remotion (the rendering framework used by Dolly and by the Claude Remotion Skill) is free for individuals and companies of up to three people, including commercial use and automated video generation. Official terms: https://www.remotion.dev/license and https://www.remotion.dev/docs/license/pricing. The $0.01-per-render / $100-per-month minimum applies only to companies that do **not** qualify for the Free License.
- **Recheck Remotion eligibility before commercial deployment if Transovo grows past three people, or if the use changes.** Until then, this is decided: no licenses are needed.

Do not spend further effort on license research. Do not call HeyGen, Higgsfield, or other paid media APIs during the test phase unless Rick explicitly approves the spend.

---

## Gate

**Start the independent tests in this plan only after the current Cinematic Skill Motion Studio implementation is completed and validated.**

Do not alter or disrupt the working Cinematic Skill pipeline. Do not integrate the new engines into Transovo until that gate is passed. Do not claim a system works until it produces a real, playable video. When the phase begins, test the engines individually and report which actually produce the most professional results — not just which have the most features.

---

## Rick's requirements (verbatim)

* Do not assume the five systems are interchangeable.
* Do not force them to share the same aesthetic.
* Do not reduce them to collections of fixed templates.
* Preserve the ability to write custom animations using each system’s capabilities.
* Do not alter or disrupt our current working Cinematic Skill pipeline.
* Do not integrate the new engines into Transovo until the current Motion Studio implementation is completed and validated.
* Do not claim a system works until it produces a real, playable video.
* Review dependency licenses, especially Remotion, before production use.

The final goal, in his words:

> Create a multi-engine Motion Studio where an AI Director can choose any of these frameworks, or combine their rendered scenes, depending on what looks best for the user’s video.
>
> We should eventually support documentaries, explainers, SaaS demos, tutorials, product advertisements, data stories, and highly polished social videos.
>
> Each project should have its own professional visual identity.

---

## Clone record (this preparation)

Four new repositories were shallow-cloned on 15 November 2026 (America/New_York) into `/workspace/engines/<name>`. Cinematic Skill was not re-cloned; the kit and the product vendor pin are the source of truth.

| Engine | Isolated path | Origin | Commit SHA | Commit time (America/New_York) | Default branch |
|---|---|---|---|---|---|
| Cinematic Skill | Kit: `/workspace/motion_kit/code_motion_cinematic/repo`. Product vendor: `worker/clips_worker/motion_studio/vendor` in `703deuce/sms`. | https://github.com/Moh4696/cinematic-skill | `bf43556` (pinned; kit copy is not a git checkout, so this SHA was not re-hashed from `.git`) | already pinned in the handover | n/a in the kit |
| Dolly | `/workspace/engines/dolly` | https://github.com/pvhuwung/dolly | `a78a82164ba4f09f1f917a9b2f0ad7c8e11ff7cc` | 13 Oct 2026, 12:37 AM EDT | `main` |
| HyperFrames | `/workspace/engines/hyperframes` | https://github.com/heygen-com/hyperframes | `e426ce4eb44517db3f65105f1e05cb7b762cd950` | 15 Nov 2026, 5:31 AM EST | `main` |
| Open 3D Skills | `/workspace/engines/open-3d-skills` | https://github.com/Moh4696/open-3d-skills | `53beb899e77f65d50160a3765f36f5ddb8b3c19b` | 9 Nov 2026, 3:03 AM EST | `main` |
| Claude Remotion Skill | `/workspace/engines/claude-remotion-skill` | https://github.com/haidrrrry/claude-remotion-skill | `1dcbe5e3fc6cf970bd10d3cc05f0a8a5d19d0383` | 12 Aug 2026, 5:04 PM EDT | `main` |

All four new remotes cloned cleanly. None is dead.

---

## Per-engine profiles

### 1. Cinematic Skill

**Purpose and strengths.** Narrated cinematic documentaries and explainers built entirely from code. One continuous camera over one designed world of photos, documents, cards, maps, routes and big numbers, with every stamp, highlight and counter landing on the narrator's word. Already the engine of the current Motion Studio, and of the Keef (map world) and GameStop (ticker world) reference films. Specialty: cinematic documentaries, evidence boards, maps, photographs, camera moves, and real-footage integration.

**Reusable components, animation, camera, styles, outputs.** Engine items include `Print`, `MapPin`, `StringLine`, `PenMark`, `Chalk`, `Stamp`, `BigText`, `Counter`, `PaperDoc`, `Card`, `Ledger`, `OpenLedger`, `FilmFrame`, `Holes`, `DotField`, `GeoMap`, `RegionFill`, `Route`, `XMarker`, plus the `Film` camera/spotlight and `Renderer`. Looks: `wall`, `slate`, `studio`, `charcoal`, `blueprint`, `paper`, `night`. Image grades: black and white, sepia, natural colour. Outputs: stills, contact strips, cue lists, parallel MP4 render, four caption styles, SRT, mixed soundtrack. Word-anchored timing via `doc.W(line, "word")` / `film.shot`.

**Tech stack and dependencies.** Python 3.9+, `skia-python` (>=87.6, tested with 144.1), numpy, pillow, optional scipy, and ffmpeg/ffprobe on PATH. Scratch voice: macOS `say`, espeak-ng, or any TTS command. Product path uses ElevenLabs. Manual: `skills/cinematic-film/SKILL.md` plus `references/{story,film,performance,sound,voice,archive}.md`. Scripts: `render.py`, `make_beats.py`, `make_map.py`, `fetch_commons.py`, `mix_soundtrack.py`, and the rest of `scripts/`.

**How to render, and the shipped examples.** `python3 scripts/check_setup.py` first, then `new_project.py`, assets, scratch voice, `render.py`. Shipped examples: `assets/template/` ("From Cherry to Cup", ~25 s studio explainer, no images) and `assets/wright-flyer/` ("Twelve Seconds", ~90 s Wright Flyer documentary). Transovo worked examples (not in the upstream repo): `code_motion_cinematic/keef/scene.py` and `round2_cinematic/gme/scene.py` + `ext.py`.

**How custom animation is written.** A per-film Python `scene.py` (and, in Transovo, `ext.py`) places items on the voice's timing and keys the camera. New worlds are invented in code — a map, a ticker, or something new — not by picking a template.

**License.** MIT (Copyright 2026 exploraX).

**Box notes.** Already running in the clips-worker. On this box, Python 3.13.5, ffmpeg, numpy and Pillow are present. `skia-python` 144.1 publishes a `cp313` manylinux x86_64 wheel, so it can be installed when tests start. `espeak-ng` and `scipy` are not installed here; the product path does not need espeak-ng.

---

### 2. Dolly

**Purpose and strengths.** An agent skill for premium product, launch, demo, advertising and social videos, written as Remotion (React) code. It records or scans real app footage, cuts it into floating windows and phones in 3D, sets type in motion, and renders every format. Specialty: SaaS demos, product showcases, branded motion graphics, and distinct professional visual styles.

**Reusable components, animation, camera, styles, outputs.** A library of 87 components (templates, kinetic type, charts and graphics, drawings, voice with captions, backdrops, transitions), indexed in `starter/src/library/CATALOG.md`. Eight styles, set in one line in `brand.ts`: `editorial`, `midnight`, `bold`, `swiss`, `soft`, `terminal`, `cinema`, `paper`. Four format compositions: `Video` 1920×1080, `Vertical` 1080×1920, `Square` 1080×1080, `Portrait` 1080×1350 (layouts avoid Reels/TikTok/Shorts UI chrome). Camera moves: `tiltIn`, `zoomIn`, `zoomOut`, `focus`, `pan`, `orbit`, `pushThrough`, via `focusOn` / `useShot`. Quality gate: `npm run check` (hook timing, stutters, dead air, cuts, loudness, file format, optional loop). `npm run web` normalizes to −14 LUFS for feeds.

**Tech stack and dependencies.** Node.js, Remotion 4.0.528 (`remotion`, `@remotion/cli`, `@remotion/google-fonts`, `@remotion/media-utils`, `@remotion/transitions`), React 18.3, TypeScript, lucide-react, ffmpeg, headless Chrome (Remotion downloads it; this box already has Google Chrome 156). Optional: observee for agent-driven recording on a Mac. Manual: `SKILL.md` and `references/{record-mac,record-elsewhere,your-footage,camera,agendas,gotchas,recipes}.md`. Starter created by `new.sh`.

**How to render, and the shipped examples.** From a project copied by `new.sh`: `npm install`, `npx remotion studio`, `npm run render` / `render:vertical` / `render:square` / `render:portrait`, then `npm run check` and `npm run web`. In-repo starters: `Video` (41 s cut of Termary's launch, from real recordings) and `Promo` (25 s motion-graphics cut made only of templates). Further example MP4s are linked from `examples/README.md` as GitHub release assets (not required to start). The Termary recordings and logo in `starter/public/` are Termary's — replace them; do not reuse them.

**How custom animation is written.** A normal Remotion project: scenes in `src/scenes/`, composition in `src/Video.tsx` / `src/Promo.tsx`, brand in `src/brand.ts`. The agent (or a person) writes new React scene code, using or extending the library and the 3D camera kit. New components are first-class; the catalog is generated from the code.

**License.** Dolly itself is MIT (Copyright 2026 David Pham). It builds on Remotion; see the license decision above.

**Box notes.** Render and edit work on this Linux box. Agent-driven live recording with observee is Mac-only; first tests should use the templates-only `Promo` composition, or scan/replace takes, rather than trying to drive a Mac app.

---

### 3. HyperFrames

**Purpose and strengths.** A free, open-source, HTML-native video framework from HeyGen: write HTML/CSS plus seekable animation, render a deterministic MP4. Strong at modern editorial motion graphics, infographics, HTML compositions, and alternative design styles. Used in production at HeyGen; community examples include tldraw and TanStack.

**Reusable components, animation, camera, styles, outputs.** Compositions are HTML with `data-start`, `data-duration`, `data-track-index`, `data-composition-id` and related attributes. Animation via GSAP, CSS, Lottie, Three.js, Anime.js, WAAPI, TypeGPU, or a custom `FrameAdapter`. Catalog of about 450 installable blocks and components (`npx hyperframes add …`): transitions, overlays, titles, kinetic type, captions, charts, maps, 3D, camera moves. Registry examples in this clone include `decision-tree`, `kinetic-type`, `nyt-graph`, `path-traced-3d`, `play-mode`, `product-promo`, `swiss-grid`, `vignelli`, `warm-grain`. `frame.md` / design templates invert a brand design system for the camera (Biennale Yellow, BlockFrame, Broadside, Capsule, and others). Skills (core): `/hyperframes`, `/hyperframes-cli`, `/hyperframes-registry`, `/media-use`, `/reverse-any-video`, `/style-sampling`. On demand: `/figma`, `/slideshow`, `/remotion-to-hyperframes`. Outputs: local MP4, Studio preview, optional AWS Lambda / GCP Cloud Run / Kubernetes render, optional share/publish (hosted review; five free projects per workspace). `/slideshow` outputs a navigable deck, not an MP4.

**Tech stack and dependencies.** Node.js >= 22, ffmpeg. The monorepo itself requires **bun 1.4.4** exactly (this box has bun 1.4.4 and Node v24.22.1). Runtime: Puppeteer / headless Chrome, `@hyperframes/{cli,core,engine,producer,player,studio,shader-transitions,aws-lambda,gcp-cloud-run,sdk}`. App use is typically `npx hyperframes` (published CLI, currently 0.9.52 in this tree), not a full monorepo build. Docs: `README.md`, `docs/quickstart.mdx`, `docs/guides/rendering.mdx`, `docs/developers/cli.mdx`, `docs/concepts/{compositions,data-attributes,frame-adapters,determinism}.mdx`, and https://hyperframes.heygen.com/introduction.

**How to render, and the shipped examples.**

```bash
npx hyperframes init my-video
cd my-video
npx hyperframes preview    # Studio at localhost:3002
npx hyperframes lint
npx hyperframes render -o output.mp4
# or: npx hyperframes render -c ./my-composition.html -o output.mp4
```

In-repo `examples/` are cloud-deploy samples (AWS Lambda, GCP Cloud Run, k8s), not starter films. For a first local example, scaffold with `init` or install a registry example such as `product-promo` or `kinetic-type` via `npx hyperframes add`. Showcase films are at https://hyperframes.heygen.com/examples.

**How custom animation is written.** Author an `index.html` (or additional composition HTML): stage elements, timing data attributes, and a seekable timeline (commonly GSAP `gsap.timeline({ paused: true })` registered on `window.__timelines`). Add catalog blocks as editable source. Custom runtimes implement `FrameAdapter` (`getDurationFrames`, `seekFrame`, `destroy`). There is no React or bundler requirement.

**License.** Apache 2.0. The optional HyperFrames Studio **Pro** plan (HeyGen video, image, voice and music models) and the Pro-marked skills (`/reverse-any-video`, `/style-sampling`) are not required for local HTML rendering. `/media-use` can call HeyGen or free local tools — tests must use local tools only, with no paid API spend.

**Box notes.** Shallow clone is 402 MB / 10,224 files. The repo uses Git LFS for golden regression MP4s (~240 MB) under `packages/producer/tests/**/output.mp4`. `git-lfs` is not installed on this box, so those baselines were not pulled. They are not needed to scaffold, lint, or render a new project with the published CLI.

---

### 4. Open 3D Skills

**Purpose and strengths.** Eight agent skills for cinematic 3D scenes and animated environments built from code (three.js), plus scroll-scrubbed films, transparent video, cursor-following characters, exploded machine views, and frame-exact recording of a page to MP4. Specialty: cinematic 3D, spatial visualizations, product reveals, and technical explainers. Same author as Cinematic Skill. Code-built scenes are small, sharp at any size, and easy for an agent to change; `exploded-view` can also load GLB files.

**Reusable components, animation, camera, styles, outputs.**

| Skill | Role |
|---|---|
| `threejs-scene` | Real-time 3D from code: buildings, vehicles, machines, landscapes; sky/sun presets, soft shadows, AO, bloom, instancing, shader patches, camera flights, quality tiers. Ships a complete 60 fps pavilion starter and notes on lighting, geometry, shaders and performance. |
| `exploded-view` | Staged explode, x-ray, section cut, labels with leader lines, picking. Ships `explode.js` and the electric-motor demo. |
| `scroll-film` | Scroll-scrubbed films from generated clips; `scroll-film.js`, prep script, seam checker. |
| `motion-assets` | Plan AI images/clips with prompts and costs up front. Loop checker and paste-back tool. |
| `alpha-cutout` | Transparent video from a key plate, including Safari; WebGL alpha player. |
| `cursor-rig` | Painted character whose head follows the cursor; rig builder and spring-driven player. |
| `site-check` | Headless Chromium and WebKit checks at three sizes; report and contact sheet. |
| `frame-capture` | Frame-exact 60 fps recording of any page on a virtual clock; labelled comparisons. This is the path from a 3D page to an MP4. |

**Tech stack and dependencies.** Skills are instructions plus plain ES modules (no framework, no build step for the browser code). Scripts: Python 3.9+, Playwright, Pillow, NumPy, OpenCV (`pip install -r requirements.txt` then `python3 -m playwright install chromium webkit`), and ffmpeg. Node 22.20+ is only needed for `npx skills` and repo checks. `threejs-scene`, `exploded-view`, `site-check` and `frame-capture` need **no** paid APIs. `motion-assets`, `alpha-cutout`, `cursor-rig` and `scroll-film` expect an image/video generation service if those skills are used.

**How to render, and the shipped examples.** Serve the page with the skill's `scripts/serve.py` (not `python3 -m http.server`, which breaks Range seeks). Record with `skills/frame-capture/scripts/record.py`. First examples: the pavilion starter at `skills/threejs-scene/assets/starter/` and the motor demo at `skills/exploded-view/assets/demo/`. Preview stills live in `examples/*.webp`. Typical record:

```bash
python3 skills/frame-capture/scripts/serve.py skills/exploded-view/assets/demo --port 8000
python3 skills/frame-capture/scripts/record.py http://127.0.0.1:8000/ out.mp4 --seconds 20 --fps 60
```

**How custom animation is written.** New three.js scene code (the starter's `scene.js` / `kit.js` / `env.js` pattern), or a new exploded-view model in code (see `assets/demo/motor.js`). Camera flights and explode stages are authored in JavaScript. The agent writes a new world; it does not only restyle the pavilion or the motor.

**License.** MIT (Copyright 2026 exploraX).

**Box notes.** This is **not** Blender. Playwright, OpenCV and the Playwright browsers are not installed on this box yet; they are ordinary pip/Playwright installs for the test phase. First tests must use `threejs-scene` + `exploded-view` + `site-check` + `frame-capture` only, so no generation-API money is spent.

---

### 5. Claude Remotion Skill

**Purpose and strengths.** An agent skill (instructions, patterns, and example code — not Claude-specific) that teaches a coding agent to produce professional Remotion motion graphics: springs, staggered choreography, color grades, film grain, Ken Burns, word-synced captions, and sound design, with a mandatory render → inspect frames → fix → re-render loop. Specialty: kinetic typography, animated social videos, Reels, Shorts, cinematic text, talking-head enhancements, and promotional motion graphics.

**Reusable components, animation, camera, styles, outputs.** Ten hard motion rules in `remotion-motion-graphics/SKILL.md` (no linear interpolation; 2–3 property entrances; stagger; faster exits; five-layer stack of background mesh / assets / graphics / grade / grain+vignette; Ken Burns on stills and `OffthreadVideo` for footage; idle "breathing"; timing from `fps`; one `theme.ts`; never ship unverified). `references/motion-patterns.md` has 17 copy-paste components (reveals, grade, grain, Ken Burns, counters, transitions, captions, and more). `references/design-rules.md` covers palettes, typography, pacing, sound, and a checklist. `assets/theme.ts` is the theme template. Outputs: Remotion MP4 (h264) and stills.

**Tech stack and dependencies.** Node.js, Remotion 4 (`remotion`, `@remotion/cli`, `@remotion/google-fonts`), React 19 in the examples project, ffmpeg, headless Chrome. The skill folder itself has no root `package.json`; the runnable project is `examples/`.

**How to render, and the shipped examples.** Four finished compositions, each already put through the inspect/fix loop:

| Composition | What it is |
|---|---|
| `HaidrrrryPromo` | 12 s profile promo: spark logo sting, word reveals, staggered cards, glow CTA |
| `FocusCatPromo` | 15.5 s app promo: pixel-art mascot drawn in code, animated focus ring, synthesized SFX |
| `SelfFix` | 18.5 s "watch this video fix itself": starts deliberately bad, then applies the motion rules live |
| `CodeEdit` | 20 s beat-synced code edit: camera in a syntax-glow code world, glitch pass, 3D shatter, synthesized 120 BPM track |

```bash
cd /workspace/engines/claude-remotion-skill/examples
npm install
npm run audio              # synthesize SFX and music; no asset downloads
npm run studio
npm run render:focuscat    # or render:selffix / render:codeedit / render:profile
npx remotion still src/index.ts SelfFix out/check_300.png --frame 300 --overwrite
```

A pre-rendered Focus Cat MP4 and GIF already ship under `examples/videos/`, plus a root `demo.mp4`.

**How custom animation is written.** A Remotion composition in React/TypeScript: a `theme.ts`, a five-layer scene stack, and original scene components. The patterns file is a craft library, not a set of fixed templates. The agent designs a new 30–60 s video and only ships it after frame inspection.

**License.** The skill is MIT (Copyright 2025 haidrrrry). It builds on Remotion; see the license decision above.

**Box notes.** Node, npm, Chrome and ffmpeg are present. `npm install` in `examples/` is the cheap first step when tests begin. No paid APIs are required; audio is synthesized locally.

---

## Environment already on this box (cheap check only)

Present, so installs should be able to proceed when the test phase starts:

- Python 3.13.5, pip, uv; numpy 2.5.4; Pillow 13.0.0
- Node v24.22.1, npm 11.21.1, pnpm 10.34.6, bun 1.4.4 (matches HyperFrames' pin), npx
- ffmpeg 7.1.5, Google Chrome 156.0.8078.47, cargo, go

Not installed yet (ordinary installs for the test phase, no full renders run during this preparation):

- `skia-python` (wheel exists for CPython 3.13 on manylinux x86_64)
- `scipy`, `opencv-python-headless`, `playwright` and Playwright browsers
- `espeak-ng` (optional; only for a local Cinematic Skill scratch voice)
- `git-lfs` (optional; only for HyperFrames golden test MP4s)

No full renders were run. No paid APIs were called. No SMS repo or server was touched.

---

## Per-engine install and test instructions

Work only under `/workspace/engines/` (and the cinematic kit path). Do not touch `/workspace/sms*`, the SMS repository, or any server. Do not integrate anything into Transovo. Create a throwaway project per engine, for example `/workspace/engines/_tests/<engine>/`. Record times, model usage and cost as you go. Stop and report if a render fails; do not claim success without a playable MP4.

Follow Rick's ten steps for **each** of the five systems, independently. Do not reuse one engine's aesthetic on another. Do not only reproduce a shipped demo for step 6.

### The ten steps (every engine)

1. **Clone into its own isolated directory.** Already done; SHAs are in the clone record above. For Cinematic Skill, use the kit / vendor pin, do not vendor a newer upstream commit into the product.
2. **Read its main instructions, skills, references, examples, and rendering documentation.** Sources are listed in each profile. The engine's own manual is the source of truth for what it can do. Shipped films are examples, not the only options.
3. **Identify reusable components, animation features, camera capabilities, visual styles, and supported outputs.** Use the profiles as a starting inventory; update them if the tree has changed.
4. **Install the dependencies and verify the rendering process** (CLI/help, typecheck or lint, a still or a one-frame probe — not a full film yet).
5. **Render an existing example first**, if one is provided. Confirm it is a real, playable MP4.
6. **Create a completely new 30–60 second video** using the system, rather than simply reproducing an existing demo.
7. **Let the agent design and produce the video autonomously**, including its scenes, animation, sound, and visual composition. Preserve custom animation; do not collapse the job into a template picker.
8. **Inspect the actual rendered frames**, identify quality problems, correct them, and rerender as necessary.
9. **Record** total generation time, rendering time, model usage, and estimated production cost.
10. **Evaluate** how professionally designed the finished video looks compared with the existing Cinematic Skill results and professional examples in that system's specialty.

### Engine-specific commands for steps 4–6

**Cinematic Skill** (from the kit scripts directory, project outside the SMS repo):

```bash
cd /workspace/motion_kit/code_motion_cinematic/repo
pip install -r requirements.txt
python3 skills/cinematic-film/scripts/check_setup.py
# Example (Wright Flyer), after fonts/assets/voice as in SKILL.md:
# python3 skills/cinematic-film/scripts/new_project.py /workspace/engines/_tests/cinematic-wright --example
# … fetch_commons, make_map, prep_assets, tts / split_takes / build_narration …
# python3 skills/cinematic-film/scripts/render.py --project … --size 1280x720 --out out/draft.mp4 --audio audio/narration.m4a
```

New film (step 6): a fresh 30–60 s topic, original `scene.py` world, not a recut of Wright Flyer, Keef, or GameStop.

**Dolly:**

```bash
/workspace/engines/dolly/new.sh /workspace/engines/_tests/dolly-starter
cd /workspace/engines/_tests/dolly-starter
npm install
npx remotion still Promo out/promo-still.png --frame=30
npm run render          # or: npm run promo   for the templates-only example
npm run check -- out/video.mp4
```

New film (step 6): an original 30–60 s product or brand piece in a style that fits the subject. Replace Termary takes and logo. Prefer `Promo` or new scenes if no real product footage is on hand. Render at least one vertical format as well.

**HyperFrames:**

```bash
npx hyperframes init /workspace/engines/_tests/hf-starter
cd /workspace/engines/_tests/hf-starter
npx hyperframes lint
npx hyperframes render -o out/example.mp4
```

If `init` is too bare, also add a registry example (`npx hyperframes add product-promo` or `kinetic-type`) and render that first. New film (step 6): original HTML composition, 30–60 s, own art direction. Use local media only; do not sign in to HeyGen or enable Pro models.

**Open 3D Skills:**

```bash
cd /workspace/engines/open-3d-skills
pip install -r requirements.txt
python3 -m playwright install chromium webkit
python3 skills/frame-capture/scripts/serve.py skills/threejs-scene/assets/starter --port 8000
python3 skills/frame-capture/scripts/record.py http://127.0.0.1:8000/ /workspace/engines/_tests/o3d-pavilion.mp4 --seconds 20 --fps 60
# Also record the motor demo in skills/exploded-view/assets/demo/
```

New film (step 6): a completely new three.js (or exploded-view) scene, 30–60 s, recorded with `frame-capture`. Do not only relight the pavilion or replay the motor. Do not call paid image/video APIs.

**Claude Remotion Skill:**

```bash
cd /workspace/engines/claude-remotion-skill/examples
npm install
npm run audio
npm run render:focuscat    # first example; then the others as needed
npx remotion still src/index.ts FocusCatPromo out/check.png --frame 100 --overwrite
```

New film (step 6): an original 30–60 s vertical social or promotional piece, new theme and scenes, following the skill's motion rules and the inspect/fix loop. Compare polish to a high-quality CapCut-style reference as well as to Cinematic Skill.

---

## Results-table template

Fill this in only after a real, playable MP4 exists for that row. Leave cells blank until then. Never mark a system "works" on docs or a still alone.

| Engine | Commit tested | Example rendered? (path, duration, resolution) | New 30–60 s video (path, duration, resolution, topic) | Generation time | Render time | Models used | Estimated cost | Frame-inspection issues found and fixed | Professional polish vs. Cinematic Skill and vs. professional examples in this specialty | Verdict (use / hold / drop) | Notes / blockers |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cinematic Skill | `bf43556` |  |  |  |  |  |  |  |  |  | Already in production pipeline; re-baseline only if useful |
| Dolly | `a78a82164ba4f09f1f917a9b2f0ad7c8e11ff7cc` |  |  |  |  |  |  |  |  |  |  |
| HyperFrames | `e426ce4eb44517db3f65105f1e05cb7b762cd950` |  |  |  |  |  |  |  |  |  |  |
| Open 3D Skills | `53beb899e77f65d50160a3765f36f5ddb8b3c19b` |  |  |  |  |  |  |  |  |  |  |
| Claude Remotion Skill | `1dcbe5e3fc6cf970bd10d3cc05f0a8a5d19d0383` |  |  |  |  |  |  |  |  |  |  |

Optional combination row, only after at least two engines have a playable original: one shared-timeline assembly of scenes from more than one engine, scored for whether a single art direction holds.

---

## What this preparation did not do

- Did not integrate any new engine into Transovo, the SMS repo, or the worker.
- Did not run full example or original renders.
- Did not spend money on licenses or generation APIs.
- Did not install the remaining Python/Playwright packages (deferred to the test phase).
- Did not change Cinematic Skill's pinned vendor commit.

When the current Motion Studio pipeline is validated, start the tests from this document, engine by engine, and fill in the results table.
