# The five core engines: what each is for, where it lives, how to run it

> The 17-engine motion-graphics library (Motion Canvas, Revideo, PixiJS, Three.js+Theatre, GSAP+SVG, p5.js, Manim, D3, MapLibre+deck.gl, Rive, Lottie, Skia, plus SAM 2/rembg/MediaPipe cutouts, OpenCV, Natron, FFmpeg effects and the Replicate note) lives in `engine-library.md`, installed at `/workspace/motion_engines/<engine>/`. Read it with this file whenever you choose engines.

## The five core engines (source code, pinned versions)

The full source of every engine is already cloned on this shared computer; read the code and each engine's own manual before using it. If a clone is missing, re-clone from GitHub and check out the pinned commit.

| # | Engine | GitHub | Pinned commit | Local source | Best for |
|---|---|---|---|---|---|
| 1 | Cinematic Skill | https://github.com/Moh4696/cinematic-skill | `bf43556` | `/workspace/motion_kit/code_motion_cinematic/repo` (manual `skills/cinematic-film/SKILL.md` + `references/`) | Narrated documentaries, one continuous camera over an invented world (maps, evidence boards, tickers), word-anchored timing |
| 2 | Dolly (Remotion) | https://github.com/pvhuwung/dolly | `a78a821` | `/workspace/engines/dolly` | Product, launch, ad and social videos; app footage floating in 3D, kinetic type |
| 3 | HyperFrames (HeyGen) | https://github.com/heygen-com/hyperframes | `e426ce4` | `/workspace/engines/hyperframes` | HTML/CSS editorial motion graphics, infographics, data cards |
| 4 | Open 3D Skills (three.js) | https://github.com/Moh4696/open-3d-skills | `53beb89` | `/workspace/engines/open-3d-skills` | Cinematic 3D scenes and environments, exploded product views, spatial explainers |
| 5 | Claude Remotion Skill | https://github.com/haidrrrry/claude-remotion-skill | `1dcbe5e` | `/workspace/engines/claude-remotion-skill` | Promos, beat-synced edits, code-built mascots and motion typography |

Restore a clone: `git clone <GitHub URL> <local path> && git -C <local path> checkout <commit>`. Multi-engine plan and per-engine profiles: `/workspace/engines/PLAN.md`.


All five are on this box. **Status:** Cinematic Skill has made real films here (Keef, GameStop, the footage-insert tests and Transovo jobs). On 16 Nov 2026 Dolly, HyperFrames, Open 3D Skills and Claude Remotion Skill passed smoke tests and were used in Rick's mixed-engine tests (Gunna 2 min, Gunna 30 s, Cowboys–49ers 30 s). `/workspace/motion_jobs/ENGINE_STATUS.md` is the source of truth: read it first. If an engine fails at render time, don't use it for the job. Log why and pick another engine on purpose (that is a stated decision, not a silent fallback). Rick authorises engine choice per job; the Transovo routine's own engine rule is owned by that routine.

Full profiles (components, styles, licences, box notes): `/workspace/engines/PLAN.md`. Read it once per new bot copy.

Never sign in to HeyGen and never enable HyperFrames Pro/paid models without explicit approval.

---

## Decision rules: which engine for which scene

Ask what the scene *is* and what the film's concept and `visualDna` need. This table gives each core engine's natural strengths, **not a fixed mapping**: for every scene, also consider the alternatives in `engine-library.md` ("Engine pool by job") and check the style ledger, so the same scene type doesn't get the same treatment film after film (SKILL.md, Director rules). Any engine can also be one layer inside another's scene. One art direction must hold across the whole film.

| The scene is… | First choice | Why | Also good |
|---|---|---|---|
| Narrated documentary spine: one continuous camera over a designed world of photos, documents, maps, routes, big numbers, every hit on the spoken word | **Cinematic Skill** | Built for exactly this; proven on Keef and GameStop; word-anchored timing; real-footage return | HyperFrames (Parallax-doc style) |
| Geographic travel: maps, routes, pins, spread across the world | **Cinematic Skill** (`GeoMap`, `Route`, `make_map.py`) | Projected public-domain boundaries, place lookup, camera fly-through | HyperFrames `references/film.md` maps |
| Evidence board / investigation / timeline wall | **Cinematic Skill** | `Print`, `StringLine`, `Stamp`, `PenMark`, `PaperDoc`, spotlight | — |
| Data story where the data is the world (price chart, counts over time) | **Cinematic Skill + custom Item** (GME `CandleChart`) for a camera *journey through* the data; **HyperFrames** for editorial infographic panels | Cinematic gives the travelling camera; HyperFrames has ~450 registry blocks incl. charts (`nyt-graph`, `swiss-grid`) | Claude Remotion counters |
| Editorial motion graphics, infographics, explainer panels, decision trees, typographic layouts with a strong design system | **HyperFrames** | HTML/CSS + GSAP, deterministic seek-render, design templates, registry | Dolly |
| SaaS / app demo, product launch, ad, real screen recordings in floating 3D windows and phones | **Dolly** | 87 components, camera kit (`tiltIn`, `pushThrough`, `orbit`…), 4 formats, `npm run check` quality gate | Claude Remotion |
| Social short, Reel/TikTok/Short, promo, kinetic typography, beat-synced edit, cinematic text, logo sting | **Claude Remotion Skill** | Ten motion rules (springs, stagger, five-layer stack, grain), word-synced captions, beat sync | Dolly `Vertical`, HyperFrames `kinetic-type` |
| Cinematic 3D: buildings, landmarks, vehicles, machines, landscapes, product reveal, camera flight | **Open 3D Skills** `threejs-scene` + `frame-capture` | Procedural three.js with real lighting; frame-exact 60 fps recording | HyperFrames 3D runtime |
| How-it-works: exploded machine/product, x-ray, section cut, labelled parts | **Open 3D Skills** `exploded-view` | Staged explode, leader-line labels, GLB support | — |
| Transparent subject over other layers (character, product cut-out) | **Open 3D Skills** `alpha-cutout` | Keying to VP9-alpha WebM / stacked MP4 | Remotion ProRes 4444 |
| Title / lower-third / caption overlay that the customer should be able to edit on its own track | **HyperFrames** (`--format webm`/`mov`) or **Remotion** (ProRes 4444 / VP9 alpha) | Both render real alpha | Cinematic: baked only (no alpha output) |

Tie-breakers:
- Keep one visual DNA per film. Engines may change per scene or per layer, but a cut between them must read as the same film; style shifts belong at environment changes or footage inserts.
- When two options fit equally, prefer the one the recent ledger entries have *not* used. For heavy layers on a tight 30 s job, prefer a render-tested engine (`ENGINE_STATUS.md`), or draft the untested one at 480p first.
- Never let engine choice drive the story. If no engine fits a planned scene, change the plan and log it.

**Keeping one art direction across engines:** write `scenes/theme.json` once:
- palette as RGB/hex
- fonts with files
- grain amount, vignette, grade
- easing family, spring presets
- safe areas

Add the `visualDna` fields (type treatments, text placement, transition grammar, pacing, texture). Then map it into each engine's theme file: library browser engines get CSS variables or a shared `theme.js`, Manim a config block, Skia constants; Cinematic `LOOK`/`MAPLOOK` dicts; Dolly `src/brand.ts` + a new style in `look.tsx` (don't just pick one of the eight); Claude Remotion `src/theme.ts`; HyperFrames CSS variables in `index.html`; Open 3D the constants at the top of `scene.js`/`env.js`.

---

## 1. Cinematic Skill (Moh4696/cinematic-skill @ `bf43556`)

- **Where:** full kit at `/workspace/motion_kit/code_motion_cinematic/repo` (not a git checkout; pinned commit per the handover). The product copy vendored in Transovo is only a *subset* (`engine.py, render.py, build_sfx.py, mix_soundtrack.py, make_beats.py`) at `worker/clips_worker/motion_studio/vendor/cinematic_skill/` in `703deuce/sms`. **Use the kit, never edit the vendored copy, and never pull a newer upstream.**
- **Manual:** `/workspace/motion_kit/code_motion_cinematic/repo/skills/cinematic-film/SKILL.md`. References in `…/cinematic-film/references/`:
  - `story.md`: story shapes per film kind
  - `film.md`: camera, clusters, map scale `K`; **read before writing any scene**
  - `performance.md`: read before 1440p/4K
  - `sound.md`
  - `voice.md`
  - `archive.md`: image sources
- **Scripts** (`…/cinematic-film/scripts/`), all take `--project <dir>`: `check_setup.py, get_fonts.py, new_project.py, make_beats.py, tts_say.py, split_takes.py, build_narration.py, fetch_commons.py, make_map.py, prep_assets.py, engine.py, render.py, build_sfx.py, mix_soundtrack.py, burn_captions.py`.
- **Worked examples (Transovo quality bar):** Keef `/workspace/motion_kit/code_motion_cinematic/keef/scene.py`; GameStop `/workspace/motion_kit/round2_cinematic/gme/{scene.py,ext.py,music.py,audit.py,measure_mix.py}`. How they were made: `reference-films.md`.
- **Environment:** Python 3.9+, `skia-python` (144.1 tested), numpy, pillow, scipy (optional), ffmpeg.
  - `skia-python` is **not** in the system Python. A ready venv with skia 144.1 + numpy + scipy + pillow exists at `/workspace/motion_lab_env`. That one belongs to the Motion Lab, so don't install into it.
  - For production, create your own once:
    ```bash
    python3 -m venv /workspace/motion_prod_env && . /workspace/motion_prod_env/bin/activate
    pip install -r /workspace/motion_kit/code_motion_cinematic/repo/requirements.txt scipy edge-tts faster-whisper
    S=/workspace/motion_kit/code_motion_cinematic/repo/skills/cinematic-film/scripts
    python3 $S/check_setup.py
    ```
  - Old scripts in the kit refer to `/workspace/code_motion_cinematic/...` (the pre-move path). That path no longer exists, so substitute `/workspace/motion_kit/code_motion_cinematic/...`.
- **Per-film flow:**
  ```bash
  python3 $S/new_project.py $J/scenes/S01 --title "…"     # blank template: you replace scene.py entirely
  python3 $S/get_fonts.py --project $J/scenes/S01
  # script.json → make_beats.py (fix every lint) → photos.json → fetch_commons.py get → make_map.py → prep_assets.py
  # voice: tts_say.py --cmd "python3 /workspace/motion_kit/code_motion_cinematic/edge_take.py {txt} {out} --rate=-8%" → split_takes.py → build_narration.py
  #        (or ElevenLabs with-timestamps → audio/words.json; see SKILL.md Stage 4)
  python3 $S/render.py --project $J/scenes/S01 --probe 1.0,3.4,8.5 --size 1280x720       # stills
  python3 $S/render.py --project $J/scenes/S01 --strip 24.4:25.6:8 --size 1280x720        # motion strip
  python3 $S/render.py --project $J/scenes/S01 --cues                                     # SFX cue list
  python3 $S/build_sfx.py --project $J/scenes/S01
  python3 $S/mix_soundtrack.py --project $J/scenes/S01 --music audio/music.wav --stems
  python3 $S/render.py --project $J/scenes/S01 --size 1920x1080 --workers 4 --t0 A --t1 B --out out/S01.tmp.mp4   # per-scene range, silent
  ```
  `--t0/--t1` render a time range of one film, which is how you cut a long Cinematic world into per-scene clips that share one camera journey. `--size 1080x1920` renders vertical: re-key the camera for the narrow frame, don't just crop.
- **Strengths:** one continuous camera; word-anchored hits; maps; prints; strings; counters; spotlight; film finish; synthesised SFX; deterministic render; custom `Item` subclasses for anything new (the GME chart, glass panels).
- **Limits:**
  - Renders opaque frames only, so overlays are baked.
  - Slow: about 0.6–1.0 fps per worker at 1080p (40–50 s film ≈ 5 min on 7 workers).
  - The engine refreshes grain only every 2nd frame (15 fps flicker); use GME's `per_frame_grain()`.
  - Default `fade_in/fade_out` (0.9/2.2 s) bleed into segment renders, so set both to 0 for scene clips.
- **Smoke test (first use per box):** `check_setup.py` passes; `new_project.py /workspace/engines/_tests/cin-smoke`, scratch voice, `render.py --size 1280x720 --out out/smoke.mp4 --audio audio/narration.m4a`, then `qa_report.py` on it.

## 2. Dolly (pvhuwung/dolly @ `a78a821`), Remotion

- **Where:** `/workspace/engines/dolly`. **Manual:** `/workspace/engines/dolly/SKILL.md`.
  - References in `/workspace/engines/dolly/references/`: `camera.md` (3D kit, moves), `your-footage.md`, `record-elsewhere.md`, `agendas.md` (non-launch videos), `gotchas.md`, `recipes.md`.
  - `record-mac.md` is Mac-only, so skip it here.
  - Component catalog: `/workspace/engines/dolly/starter/src/library/CATALOG.md`.
- **Setup:** `/workspace/engines/dolly/new.sh $J/scenes/S02` (copies the starter, runs npm install, generates SFX, downloads headless Chrome; Google Chrome 156 is also at `/usr/bin/google-chrome`).
- **Build:** scenes in `src/scenes/`, composition `src/Video.tsx` (or a new one), brand/style in `src/brand.ts` + `src/look.tsx`. **Replace the Termary takes and logo in `public/`; they are not ours to ship.**
- **Review/render:**
  ```bash
  npx remotion still Sheet out/sheet.png                      # 1 frame/s sheet, read it
  npx remotion render Video out/draft.mp4 --scale=0.5 && npm run check -- out/draft.mp4   # stutter / dead air / hook / loudness
  npm run render | render:vertical | render:square | render:portrait
  npx remotion render <Comp> out/S02.mov --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le   # alpha overlay
  ```
- **Strengths:** product/SaaS demos from real recordings in 3D windows/phones; branded motion graphics; all four formats with platform-safe layouts; a built-in quality checker.
- **Limits:** live agent recording (observee) is Mac-only, so use customer recordings or code-drawn UI. **Smoke-tested 16 Nov 2026** (see `ENGINE_STATUS.md`).
- **Smoke test:** `new.sh /workspace/engines/_tests/dolly-smoke && cd … && npx remotion still Promo out/p.png --frame=30 && npm run promo && npm run check -- out/promo.mp4`.

## 3. HyperFrames (heygen-com/hyperframes @ `e426ce4`), HTML → video

- **Where:** `/workspace/engines/hyperframes`.
- **Manuals:**
  - core: `/workspace/engines/hyperframes/skills/hyperframes/SKILL.md` (the render contract, 12 rules; the work loop; a "What to read" table pointing at `references/types/{launch,explainer,music,data,vertical,3d,character}.md`, `references/{film,motion,captions,overlays,format,runtimes,story,spec,review,sound,look}.md`)
  - CLI: `/workspace/engines/hyperframes/skills/hyperframes-cli/SKILL.md`
  - registry: `/workspace/engines/hyperframes/skills/hyperframes-registry/SKILL.md`
  - media: `/workspace/engines/hyperframes/skills/media-use/SKILL.md` (local tools only; no HeyGen)
  - craft skills in `/workspace/engines/hyperframes/.agents/skills/` (`motion-doctrine`, `seam-craft`, `cut-the-curve`, `captions-overlay`)
  - rendering docs: `/workspace/engines/hyperframes/docs/guides/rendering.mdx`
- **Setup:** Node ≥22 (box has v24), ffmpeg, Chrome. Use the published CLI via `npx hyperframes` (0.9.52 in tree); no monorepo build needed. Skip the `events` telemetry beacon the manual mentions: customer jobs should not emit third-party telemetry, so set the CLI's opt-out if it offers one.
- **Build/render:**
  ```bash
  npx hyperframes init $J/scenes/S05 --skip-skills
  npx hyperframes add <block>                 # search the registry before hand-writing an effect
  npx hyperframes lint && npx hyperframes check --json     # fix every error
  npx hyperframes snapshot --at 1,3,5          # read the PNGs under .hyperframes/artifacts/snapshots/
  npx hyperframes render --quality delivery -o out/S05.mp4
  npx hyperframes render --format webm -o out/S05_overlay.webm   # transparent overlay; --format mov for ProRes
  ```
  Contract highlights: every timed element is `class="clip"` with `data-start`/`data-duration`; there is one paused GSAP timeline registered on `window.__timelines`; no `Date.now()`, unseeded random, network fetches or timers; assets via `assets/…` paths.
- **Strengths:** editorial motion graphics; infographics and charts; strong typographic design systems; deterministic; true alpha output; ~450 registry blocks as editable source.
- **Limits:** the manual's "stop at preview for approval" steps assume a human. In a production job you are autonomous, so do the check, snapshot and review loop yourself, then render. **Smoke-tested 16 Nov 2026** (see `ENGINE_STATUS.md`). (A HyperFrames "Parallax doc" variant was rendered for Keef/GME in an earlier round elsewhere; its folders are not on this box.)
- **Smoke test:** `npx hyperframes init /workspace/engines/_tests/hf-smoke --skip-skills && cd … && npx hyperframes lint && npx hyperframes render -o out/smoke.mp4`.

## 4. Open 3D Skills (Moh4696/open-3d-skills @ `53beb89`), three.js

- **Where:** `/workspace/engines/open-3d-skills/skills/`.
- **Manuals** (each `SKILL.md`):
  - `threejs-scene` (+ `references/{geometry,lighting,shaders,performance}.md`, starter `assets/starter/{index.html,main.js,env.js,kit.js,scene.js}`)
  - `exploded-view` (`assets/explode.js`, demo `assets/demo/{index.html,motor.js}`)
  - `frame-capture` (`scripts/{serve.py,record.py,compare.py}`)
  - `site-check`, `alpha-cutout`, `motion-assets`, `scroll-film`, `cursor-rig`
- **Setup:**
  ```bash
  . /workspace/motion_prod_env/bin/activate
  pip install -r /workspace/engines/open-3d-skills/requirements.txt && python3 -m playwright install chromium webkit
  ```
- **Build/record:** copy the starter, keep `env.js/kit.js/main.js`, and write a new `scene.js` for this subject from real dimensions in metres. Drive the camera flight with `window.__recordFrame = t => {…}` behind `?record=1`, and expose `window.__ready`.
  ```bash
  O=/workspace/engines/open-3d-skills/skills/frame-capture/scripts
  python3 $O/serve.py $J/scenes/S04/site --port 8xxx &          # pick a free port; NEVER python -m http.server (breaks video seeks)
  python3 $O/record.py http://127.0.0.1:8xxx/?record=1 /tmp/S04_check.mp4 --seconds 12 --fps 8      # timing pass
  python3 $O/record.py http://127.0.0.1:8xxx/?record=1 $J/scenes/S04/out/S04.tmp.mp4 --seconds 12 --fps 30 --size 1920x1080 --ready "window.__ready === true"
  ```
  Record at 30 fps for Transovo, to match the timeline. Kill the server afterwards.
- **Strengths:** convincing procedural 3D (light and proportion), exploded/x-ray product views, camera flights, frame-exact recording.
- **Limits:**
  - Not Blender.
  - `motion-assets`, `alpha-cutout`, `scroll-film` and `cursor-rig` expect paid image/video generation, so price and log those first.
  - Recording is CPU-heavy, so take the render lock.
  - **Smoke-tested 16 Nov 2026** (see `ENGINE_STATUS.md`).
- **Smoke test:** serve and record the pavilion starter for 5 s at 8 fps, then the motor demo, then run `qa_report.py`.

## 5. Claude Remotion Skill (haidrrrry/claude-remotion-skill @ `1dcbe5e`)

- **Where:** `/workspace/engines/claude-remotion-skill`. **Manual:** `/workspace/engines/claude-remotion-skill/remotion-motion-graphics/SKILL.md` (ten non-negotiable motion rules; the mandatory render → inspect → fix loop).
  - Craft library: `…/remotion-motion-graphics/references/motion-patterns.md` (17 components: BgMesh, Grade, Grain, Vignette, KenBurns, WordReveal, Stagger, Counter, captions, transitions, parallax).
  - Design: `…/references/design-rules.md`, which ends in a final checklist to run.
  - Theme template: `…/assets/theme.ts`.
- **Runnable examples:** `/workspace/engines/claude-remotion-skill/examples` (`npm install && npm run audio`; scripts `render:profile|focuscat|selffix|codeedit`). These are for study, never output.
- **New scene project:**
  ```bash
  mkdir -p $J/scenes/S01 && cd $J/scenes/S01 && npm init -y && npm i remotion @remotion/cli react react-dom @remotion/transitions @remotion/google-fonts
  cp /workspace/engines/claude-remotion-skill/remotion-motion-graphics/assets/theme.ts src/theme.ts   # then set it from scenes/theme.json
  npx remotion still src/index.ts <Comp> out/check_45.png --frame 45 --overwrite
  npx remotion render src/index.ts <Comp> out/S01.tmp.mp4 --codec h264 --crf 16
  npx remotion render src/index.ts <Comp> out/S01_overlay.webm --codec vp9 --pixel-format yuva420p   # alpha overlay
  ```
  If Chrome errors, pass `--browser-executable=/usr/bin/google-chrome` (or a Playwright `headless_shell`).
- **Strengths:** kinetic typography, social shorts, promos, beat-synced edits, word-synced captions, logo stings, polishing existing footage (`<OffthreadVideo>`).
- **Limits:** a craft guide, not a world engine, so long documentary journeys belong in Cinematic Skill. **Smoke-tested 16 Nov 2026** (see `ENGINE_STATUS.md`).
- **Smoke test:** in `examples/`, `npm install && npm run audio && npm run render:focuscat`, then `qa_report.py out/focus-cat-promo.mp4 --out /tmp/smoke_crs`.

---

## Per-scene export rules (all engines)

Every scene is delivered as its own clip, so the editor can place it on a track:
- **Exact frame count.** Frames = round(planned duration × 30), 30 fps CFR, the job's resolution, H.264 yuv420p, CRF 16, `+faststart`, no audio (sound lives in the stems). Check it with `ffprobe -count_frames`.
- **No baked fades** at scene edges unless the fade is the designed transition *and* `project.json` records it on that clip. Cross-scene dissolves are made at assembly (`xfade`) and recorded as a `transition` element, not baked into both clips.
- **Handles:** when a scene ends on a camera move, render 0.5 s of extra frames at each end into `scenes/<id>/out/<id>_handles.mp4`, so editor trims and revision re-timing have material. The main clip stays exact.
- **Alpha overlays:** ProRes 4444 `.mov` or VP9-alpha `.webm` as the source of truth. See `delivery-contract.md` §3 for the upload limitation.
- **Source kept:** the scene folder (code, theme, assets references, `README.md` with the exact re-render command) is zipped into the source bundle.

## API keys (env var names only; never print values)

| Purpose | Env var | Needed for |
|---|---|---|
| Final narration with word timestamps | `ELEVENLABS_API_KEY` | Stage 4 (no key → report it; don't silently ship scratch voice) |
| LLM help / research / vision checks | `OPENAI_API_KEY`, `GEMINI_API_KEY` | optional |
| Stock footage/photos | `PEXELS_API_KEY`, `PIXABAY_API_KEY` | optional |
| YouTube search metadata | `YOUTUBE_DATA_API_KEY` | optional (yt-dlp needs no key) |
| Image/video generation | `KIE_API_KEY`, `REPLICATE_API_TOKEN` | optional, priced and logged first |

None of these variables is set in this box's default shell environment (checked 15 Nov 2026). The production bot must be given its keys through its own vault or env (Rick configures that). Check for a key by testing whether it is set (`[ -n "$ELEVENLABS_API_KEY" ]`), never by printing it. Free paths that need no key: edge-tts scratch voice, Wikimedia Commons, yt-dlp, synthesised SFX and music.
