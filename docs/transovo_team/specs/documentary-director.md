# Motion Graphics Director (serves footage-edit enhancement + faceless documentaries)

**Status:** **GATE PASSED** (14 Nov 2026, 11:51 PM ET, relayed by the CoS). The full build spec is now `specs/transovo-studio-build.md`, scoped to **documentaries only** (John, 15 Nov 2026, 12:02 AM ET). This file remains the engine/director reference (style spec, timeline, return rules, QA A1–A17). Draft issues: `drafts/transovo-studio-issues.md` (not filed).
**Product decision (John, 14 Nov 2026, relayed by Chief of Staff):** this will be its **own product**, but first we prove render quality: *"It's gonna be its own product, but first we need to see if we can get it working first. We wanna see what it look like before we try to build all this stuff, all this UI and all that for it."*
**Engine (John, relayed by the CoS, 14 Nov 2026, 11:27 PM ET):** **Cinematic Skill** is the base engine (`github.com/Moh4696/cinematic-skill`, MIT). Phase 0 is closed (§1.8).
**UX concept:** John's "Transovo Studio" product/UX concept is saved verbatim at `specs/documentary-studio-ux-concept.md` and folded into §4 as the later-phase UX. Spec only: John still wants renders he likes before any UI or build work.
**Author:** Product Manager · **Date:** Sat 14 Nov 2026, America/New_York (ET)
**Requested by:** John, via the Chief of Staff (original "AI Documentary Director" brief, then reframed tonight as a Motion Graphics Director).
**Repo checked:** `703deuce/sms` master `05ac1600` (#1197, committed 14 Nov 2026, 3:22 PM ET). This was a read-only check through the GitHub API, with no clone or writes.
**Research folded in:** `/workspace/transovo_team/research/documentary-director.md` (Researcher, 14 Nov 2026), cited as **[R §x]**. Also `research/motion-graphics.md` **[MG]** and `research/motion-graphics-style-variety.md` (Researcher, 14 Nov 2026) **[SV §x]**.
**File name:** kept as `documentary-director.md` at the CoS's request. The title reflects the reframe.

Hard rules apply throughout:
- Never touch the SMS worker or Coolify app3.
- Credits only and never `$` in the product UI. (A `$10,000` that a *speaker says* is user content in the video, not product pricing.)
- Additive migrations only.
- Protected modes stay untouched: upload clipping, stream clipping, the editor, Story, multi-source Story, Clean Take.
- No automatic paid retries.
- Never print secrets or signed URLs.
- Do not assign story angles in editorial prompts. The Director illustrates the edit it is given; it does not re-angle the story.

---

## 0. Summary

1. **What it is.** One Motion Graphics Director (MGD) that sits **after** story/footage/dialogue editing.
   - **Input:** the final edited sequence, its transcript with word timestamps, visual context (shots, face boxes, framing) and timing.
   - **Output:** it picks the few moments that matter and designs graphics for them: text and data, 2.5D camera scenes, and compositing over footage.
   - Preview and export are unified (the same rendered frames).
   - **Master timeline (John, 14 Nov 2026, 10:43 PM ET, endorsed: *"That's exactly how I'd want Transovo's documentary editor to work"*):**
     - One timeline holds narration, graphics, footage and music/SFX tracks.
     - Graphics are **never** a fixed rendered video with footage spliced in.
     - There are three capabilities: **INSERT**, **OVERLAY** and **RETURN**.
     - There are two footage modes: the clip plays with its own audio and extends the runtime, or it plays as B-roll under narration.
     - Boundary: the footage editor decides **what** the audience sees; MGD decides **how** it is presented (§2.4).
2. **It serves two uses with one engine:**
   - (a) enhancing existing edits: talking heads, interviews, instructional videos;
   - (b) faceless documentaries. The original documentary brief (narration-driven beat table, footage/photo-hold/interview playback, when-not-to-animate) becomes **Milestone 2** on the same engine.
3. **Three levels of motion design:**
   - L1 primitives;
   - L2 designed blocks built from primitives;
   - L3 agent compositions that combine the two.
   - It is neither rigid templates only nor an agent inventing every animation from scratch.
4. **Order of work:**
   - **Phase 0:** engine bake-off. **Closed:** John picked Cinematic Skill (§1.8).
   - **M1 proof:** one already-edited 60s talking head becomes a professional documentary-style edit, made with scripts and an internal harness only.
   - **Gate:** John watches the renders.
   - Only then do UI, data model, credits, nav and longer docs happen.
5. **Style variety (John, 14 Nov 2026).** *"We can't have everybody's video look exactly the same,"* and variety can't be *"just with a different color, or this was a map, and now it's, that's a chalkboard."*
   - Each video gets a **style spec**: one episode world with one anchor motif, chosen from the whole script, on top of fixed house quality constants.
   - Specs must pass a distance check against recent outputs (§2.5).
   - The Keef evidence-desk/map look is one world, not the default.
6. **Composition first (John-endorsed, relayed by the CoS, 11:27 PM ET).**
   - Every cinematic scene has three layers (foreground hero, midground context, procedural background world).
   - Simplicity must feel deliberate, checked by a whole-frame composition QA check.
   - Complete, subject-specific compositions come **before** more transitions or animations (§2.3, §2.8, §4).
7. **Economics.** No per-second generated video on the default path. Graphics are CPU-rendered in code. AI video is off by default **[R §4.2, §5.1]**.

8. **Cut vs graphic-led transition: both options, always (John decision, 14 Nov 2026, 10:47 PM ET).** *"In a perfect world, I would like the option of both… whatever would look better. We want to get to a point that the agent eventually can make that decision, whichever one's better, whether to cut or whether to do an overlay into it… But I want it to have the option of both."* (§2.4)
   - **Update (John, relayed by the CoS, ~11:45 PM ET), after the insert/return tests:** *"Nah, on both of them, the, the, the animating into the video looks way better. The cuts, the cuts are just too abrupt. I'm gonna be honest, the cuts are way too abrupt."*
     - The **animated push-in/pull-out (RETURN) is now the default** transition into real footage.
     - Hard cuts are an exception the director must justify with a logged reason.
     - Both options stay available.

### Decision log
| Date (ET) | Decision (John) |
|---|---|
| 14 Nov 2026 | Own product; prove render quality first, with no UI or build until he likes the renders (header). |
| 14 Nov 2026 | Style variety: no recoloured or prop-swapped sameness (§2.5). |
| 14 Nov 2026, 10:43 PM | Master timeline with INSERT, OVERLAY and RETURN, two footage modes, and the WHAT/HOW boundary (§2.4). |
| 14 Nov 2026, 11:27 PM (relayed by the CoS) | **Engine:** Cinematic Skill (MIT, Python + skia-python) is the base engine after bake-off round 2 (GameStop test film). Custom-canvas (skia) touches may be borrowed. Parallax Doc, HyperFrames and Remotion are not chosen (§1.8). |
| 14 Nov 2026, 11:27 PM (relayed by the CoS) | **Three-layer composition** for every cinematic scene. Backgrounds come from procedural, per-subject background systems with no image-gen per scene (§2.3, §2.5). |
| 14 Nov 2026, 11:27 PM (relayed by the CoS) | **Design rule:** never fill space for its own sake; simplicity must feel deliberate. Whole-frame composition QA (§2.8 A14, B9). |
| 14 Nov 2026, 11:27 PM (relayed by the CoS) | **Priority:** complete, subject-specific compositions ahead of more transitions or animations (§2 scope order, §4). |
| 14 Nov 2026, ~11:45 PM (relayed by the CoS) | **RETURN is the default transition into real footage**; a hard cut is a justified, logged exception; both options stay available. RETURN is **required in M1**. Verdict on the Keef and GameStop tests: *"Nah, on both of them, the, the, the animating into the video looks way better. The cuts, the cuts are just too abrupt. I'm gonna be honest, the cuts are way too abrupt."* |
| 14 Nov 2026, 11:48 PM (relayed by the CoS) | **Frame-exact seams:** every return's dive-in still **is** the clip's exact in-point frame (frame grab), and the pull-out starts from the exact out-point frame. A frame grab is **required**: no image-gen or approximate stills. Hard cuts are allowed only when the frames line up exactly. *"it just looks better when you go in and out... there might be some times that a hard cut might be fine... if it's perfect, if it can line up exactly for that picture... if you got a video to take a screenshot of whatever screen, of the frame first, and then take a screenshot of the frame after... It looks more produced versus just slapping through and just slapping back."* |
| 14 Nov 2026 (UX concept) | **First public release targets 5-minute documentaries**; 10–30 min later (`documentary-studio-ux-concept.md` §9). |
| 14 Nov 2026 (resolved by hard rule, **pending John's confirmation**) | The concept's "estimated production cost" is shown as an **estimated minute/credit allowance with no dollar amounts**, because of the hard rule against `$` in the product UI (§4, §7 Q14). |
| 14 Nov 2026, 10:47 PM | Every transition into or out of footage has **both** options: a hard cut, or a graphic-led transition (a RETURN dive-in, or an overlay that carries into the clip). The choice is made per moment on which looks better, with the reason logged. The end goal is for the agent to decide autonomously; until it does so reliably, Video Quality reviews its choices. |

---

## 1. Phase 0: engine bake-off — CLOSED (John picked Cinematic Skill)

**Closure note (relayed by the CoS, 14 Nov 2026, 11:27 PM ET).**
- John chose Cinematic Skill directly after round 2 (GameStop test film).
- **Superseded by his direct pick (not run as specified, no scores invented):**
  - the weighted scoring and decision rule in §1.4–1.5, including the Python-worker tie-break and the Node/Chrome rule;
  - the native HyperFrames test (candidate D).
- **Carried into M1 as capability checks on Cinematic Skill** (they're no longer bake-off gates): the over-footage compositing and world-range tests (§1.3 items 2–3).
- **Still running:** the insert/return test (§1.3 item 4) on the Keef and GameStop films. Its pass criteria still apply.
- **Still required:** the render-time measurement (§1.6), now for Cinematic Skill only, as an M1 prerequisite.
- The text below is kept as the record of the planned bake-off.

**Where it runs:** the shared box and/or a DevOps-approved non-production render box. No repo changes, no deploys, no SMS worker or app3.

### 1.1 Problem
We need one renderer that can draw broadcast-quality text/data and 2.5D camera scenes, both full-frame and composited over real footage. It must be cheap on CPU and deterministic, and it has to fit next to our Python/ffmpeg clips worker. The live engine (ASS/libass, B0.5) is excellent for text but weak at masks, 3D, particles and path motion **[MG §3 table]**.

### 1.2 Candidates
| # | Candidate | What it is | Box location | Licence |
|---|---|---|---|---|
| A | **Custom canvas** | Our own skia-python renderer (`render.py`, word-anchored timing from `words.json`, beat table) | `/workspace/code_motion_test/` | Ours. Its fonts must be checked. Its test VO used edge-tts, which is **not** a sanctioned production TTS. |
| B | **Cinematic Skill** | Python Skia; one continuous camera over a designed board; stamps and numbers on the word | `/workspace/code_motion_cinematic/` (`Moh4696/cinematic-skill`) | MIT **[R §1.2]** |
| C | **Parallax Doc** | HTML + GSAP rendered by HyperFrames; layered parallax; its README says it generates AI images | `/workspace/code_motion_parallax/` (`sanskarprajapati/parallax-doc`) | MIT + SIL OFL font **[R §1.3]** |
| D | **HyperFrames (native)** | HeyGen's HTML→MP4 framework (Chrome + FFmpeg), not the Parallax style pack | not on box yet | Apache 2.0 **[R §1.4]** |

D is included because Researcher names HyperFrames the strong alternative and recommends it for the bake-off **[R §1.1, §5.2]**. C partly exercises it already. D only needs a separate render if C wins on look, to separate the engine from the style pack.

**Out of Phase 0:**
- **Remotion + Three.js**, pending John's headcount/licence answer. The free tier covers only orgs of three or fewer **[R §1.8]**.
- Motion Canvas, Animate, Every Frame Is Code and Collage. Researcher classes these as references, not runtimes **[R §5.2]**.

### 1.3 Test material
1. **Faceless:** the three Chief Keef test renders the CoS is sharing tonight (custom canvas, Cinematic Skill, Parallax Doc). Same topic, roughly 40–90s.
2. **Over footage (added for this reframe):** each surviving engine renders the **§2.6 worked example** composited over one real 60s talking head. A faceless film alone doesn't prove the main use.
3. **World range (added for style variety):** each surviving engine renders that same S1 moment in **two clearly different worlds** (for example an evidence desk vs a typographic stage). These must differ on layout, camera, material and motif, not just colour. We want an engine that can express several worlds, not one board renderer **[SV §5.4]**.

4. **Round 2: RETURN proof (after round 1 scoring, top 2 engines).**
   - A 15–20s demo: the camera dives into a photo on the board, the photo becomes the real clip (authorized footage, 4–6s), then the camera pulls back out of the same photo and the world carries on.
   - **Pass criteria:**
     - (1) **Seamless entry and exit.** Boundary frames match in the photo region (SSIM ≥ 0.95, a PM proposal for VQ to tune), with no flash or black frame.
     - (2) **No visible pop.** VQ checks ±10 frames at each boundary frame by frame.
     - (3) **World state matches.** The camera pose and object states at re-entry equal the saved exit state, compared numerically and logged.
     - (4) **Renders inside the candidate engine and harness pipeline.** No hand compositing in another tool, and the render is deterministic.

### 1.4 Criteria and scoring
Video Quality (VQ) and the CoS score each engine 1–5 per criterion. Licence is pass/fail.

| Criterion | Weight | How measured |
|---|---|---|
| Visual quality ("looks like a pro made it, not PowerPoint") | 25% | VQ blind review of both test items, rubric in §2.8 |
| Over-footage compositing (alpha, face-safe layout, grade match) | 10% | Test item 2 |
| RETURN capability (round 2) | 10% | Test item 4 pass criteria (1)–(4); 1 = fails, 5 = passes all with no visible seam |
| Render speed / cost per finished minute | 10% | Measured wall-clock and CPU on the reference box at 1080p30, both draft and final quality |
| Determinism and word-sync | 10% | The same input rendered twice is frame-identical; hits land within ±1 frame of the word timestamp |
| Fit with the existing pipeline | 10% | Python worker + ffmpeg (`worker/clips_worker/render_job.py`, `RENDER_CLIP`) vs a new Node/Chrome lane |
| World range (test item 3: distinct worlds without engine changes) | 10% |
| Maintainability / agent-authorability | 5% | Can a typed sandbox API (§2.3) compile to it cleanly? Size and readability of the scene code |
| Cost to operate | 10% | New runtime dependencies, memory, concurrency on CPU boxes |
| **Licence** (code, fonts, any images) | gate | Must pass. No unlicensed fonts, no AI images presented as evidence **[R §3.4, §4.4]** |

### 1.5 Decision rule
1. Drop any engine that fails licence.
2. Pick the highest weighted score. If the top two are within 0.3 points, **prefer the one that runs in the Python worker without a new browser runtime**, which matches Researcher's default **[R §5.2]**.
3. Choose a Node/Chrome engine (C or D) only if it beats the best Python engine by ≥ 0.5 on visual quality **and** DevOps signs off on operating it.
4. If no engine scores ≥ 3.5 on visual quality over footage, stop. Report to John before M1.
5. The final pick is made after round 2.
   - If the leader fails RETURN, it can still carry M1 (overlay/insert), but we report that to John before M1, because RETURN is core to the endorsed design and required for M2.
   - If the scores are close, prefer an engine that passes RETURN.

The CoS records the decision in this file (§1.8) and relays it to John. Researcher's working recommendation is our **own Python Skia/canvas renderer inspired by Cinematic Skill**, assembled in the existing editor, with QA adapted from Video Director. That is the hypothesis to test, not a decision.

### 1.6 Prerequisite: render-time measurement (also gates M1)
- Measure render minutes per finished minute for each engine at 1080p30, for a 60s clip and a 3-minute mixed sequence that includes one RETURN segment.
- Use the shared box, plus a Hetzner render box only if DevOps approves.
- Report peak memory and CPU cores.
- Extrapolate to 15 minutes and label it as an extrapolation. Researcher flags 15-minute render time on Hetzner as **unmeasured** **[R §6 item 5]**.

### 1.7 Failure / logging / tests / release (Phase 0)
- **Failure:** a candidate that cannot render a test item is scored 1 on that item with the error recorded. Nobody fixes another project's bugs to make it win.
- **Logging:** engine, git SHA of the vendored repo, command, wall-clock, CPU, peak RAM, output path, fonts used. Never log keys.
- **Tests:** a determinism re-render (frame-hash compare) and the word-sync check (§2.8 automated gate A4).
- **Release condition:** the scored table plus the contact sheets go to the CoS → John. No production change.

### 1.8 Motion engine selection — DECIDED: Cinematic Skill (John, relayed by the CoS, 14 Nov 2026, 11:27 PM ET)
**Outcome:**
- **Base engine:** Cinematic Skill (`Moh4696/cinematic-skill`, MIT). The box copy is `/workspace/code_motion_cinematic/repo` at commit `bf435561` (9 Nov 2026).
- Some custom-engine (skia, `/workspace/code_motion_test`) touches may be borrowed.
- **Not chosen:** Parallax Doc / HyperFrames (C, D). Remotion was never in Phase 0.
- **Round 2 test film:** GameStop.
- **Look vs tie-break:** John picked on look. The §1.5 tie-break preferred an engine running in the Python worker. Cinematic Skill *is* Python, so his pick doesn't conflict with that rule; it simply makes the scoring moot.

**Runtime (PM read of the box copy, read-only):**
- Python 3 with `skia-python` (≥ 87.6, tested 144.1), `numpy`, `pillow`, optional `scipy`, plus `ffmpeg`/`ffprobe` on PATH (`requirements.txt`).
- Node is only needed for the optional `npx skills` installer.
- Scripts in `skills/cinematic-film/scripts/` include `engine.py`, `render.py`, `make_map.py`, `fetch_commons.py` (Wikimedia Commons with licences), `tts_say.py` (Piper TTS), `build_sfx.py`, `mix_soundtrack.py` and `burn_captions.py`.
- Scenes are short Python files keyed to voice words (`doc.W(line, "word")`).
- **Licence:** MIT, confirmed from the repo LICENSE in the earlier box check. Bundled fonts and Piper voice licences still need checking before production.

**Insert/return test results (relayed by the CoS, ~11:45 PM ET; PM ffprobe, read-only):**

| Test | Folder | Inserted clip | Outputs (1920×1080, 30 fps) | Rendered vs reused | Wall-clock |
|---|---|---|---|---|---|
| Keef | `/workspace/keef_insert_test/` | Official "I Don't Like" video, 9s. The source file `src/idontlike_official.mp4` is **1280×720** | `hardcut.mp4` 48.81s · `return.mp4` 50.65s | Only the push (1.2s) and pull (1.2s) were rendered; the rest was reused | ~22 min, as reported (a **partial render**, not a full film) |
| GameStop | `/workspace/gme_insert_test/` | Keith Gill CNBC hearing clip, 9.6s (`src/insert_full.mp4`, 1920×1080) | `hardcut.mp4` 62.31s · `return.mp4` 62.74s | About 4s of hold/push/pull rendered; the rest reused | ~15 min, as reported (partial render) |

- **Neither test needed full regeneration.** That's evidence for segment-level re-render on the master timeline (§2.4).
- **John's verdict:** *"Nah, on both of them, the, the, the animating into the video looks way better. The cuts, the cuts are just too abrupt. I'm gonna be honest, the cuts are way too abrupt."* → RETURN becomes the default (§2.4).
- **Licensing:** both tests used **third-party copyrighted clips** (an official music video and a CNBC broadcast). That is acceptable **only as internal test material, never as product or marketing output** (§5 R1–R2; "never treat arbitrary online clips as licensed", §4).

**Earlier status, kept for the record (as reported by the CoS, not independently verified by PM):**
**Status as reported by the CoS, 14 Nov 2026 (not independently verified by PM):**
- **Custom canvas:** a first draft exists at `/workspace/code_motion_test/draft1.mp4`.
  - PM ffprobe, read-only: 39.32 s, 1920×1080, 30 fps, with audio.
  - The voiceover is edge-tts, which is test-only and not a production voice.
  - **John reacted very positively:** he said it looked like it could have been cut in Adobe Premiere, even as a first draft.
- **Cinematic Skill and Parallax Doc:** still building. Finals and scores are to come.
- **Premium voice:** an ElevenLabs premium voice for the test renders is pending John's OK on spend (§7 Q11). No spend is implied by this spec.
- **Result:** superseded by John's direct pick (above).
- John's positive reaction is to one look. Per §2.5 it does **not** make the Keef evidence-desk/map world the product default.

---

## 2. Milestone 1 proof: an already-edited 60s talking head becomes a professional documentary-style edit

**This is John's priority.**

**M1 scope order (priority, John, relayed by the CoS, 11:27 PM ET):**
1. **Complete, subject-specific compositions in Cinematic Skill:** three layers, a procedural background system, foreground depth, lighting, camera and typography as one coherent design.
2. The M1 blocks and overlays (§2.3) built on those compositions.
3. **RETURN, required** (default into footage, John ~11:45 PM ET), alongside composition. Also the justified hard-cut exception and the return craft rules (§2.4). Only *more* transitions and animations rank below composition.
- Built with scripts/CLI or an internal harness on the box only (suggested path: `/workspace/motion_director/`).
- No product UI, no repo changes, no new tables, no new story editor, clipper or video-generation model.
- The input is already edited, so we don't re-cut it.

### 2.1 Problem and benchmark
Today, AI graphics on a clip look like "it has animations". Our current planner picks from a small set of text templates **[existing `suggest.ts`]**.

**Benchmark question:** *Does the rendered video look like a professional editor made it, not merely like it has animations?*

### 2.2 Persona and workflow
**Persona:** a creator, coach or founder with a finished 60s talking-head edit (an interview answer, a story, an explainer) who wants the documentary/"YouTube essay" graphic treatment without an After Effects editor.

**Use cases:**
- (a) **talking head / interview enhancement**, the M1 core;
- (b) **tutorials** (in scope, John): a face cam in a box with motion graphics or a screen recording around it;
- (c) **faceless documentary segments** (M2).

**Tutorial style rules [SV §4.1]:**
- The face-cam layout and caption kit are **house constants**.
- Variety comes from what's on screen and the callout language, not from a new cam frame every episode.
- Never force a cinematic cork wall over a tutorial.
- Reuse the existing facecam geometry (`new-app/lib/clips/facecam-geometry.ts`) where it fits.

**M1 workflow (harness, operator-run):**
1. **Input:**
   - the edited MP4;
   - a transcript with word timestamps (`ClipWord {w,s,e,spk}` shape, `new-app/lib/clips/edits.ts`);
   - optional brand colours/fonts.
2. **Analyse:**
   - shots/scene cuts;
   - face boxes per frame (or per 0.5s);
   - the safe area;
   - average luma/colour of the grade;
   - contact sheet frames.
3. **Style spec (before any moment design):** a model reads the whole transcript plus the contact sheet and proposes a style spec with a plain-language rationale (§2.5). The distance check runs against recent outputs; if it fails, regenerate.
4. **Director plan:** a model reads the **whole transcript plus contact-sheet frames**, and designs moments *inside* the approved style spec. It picks 3–6 meaningful moments and emits a **moment table** (§2.6 / Appendix B). Every moment carries a `reason`. "No graphic" is a valid choice.
5. **Render samples:** for each moment, a few key frames plus a short low-res preview. Then the automated QA gates (§2.8) run.
6. **Visual self-review:** the model looks at its own sample frames against the rubric. It may revise a moment, **at most 2 revision rounds per moment**. The fixed cap is logged; this is a designed step, not an auto-retry. It drops any graphic that doesn't improve the moment.
7. **Final render from the master timeline:**
   - The harness writes `timeline.json` (§2.4, Appendix B). Graphic segments are rendered from their parameters (style spec + moment + world state) and composited per track with ffmpeg.
   - There is no pre-baked graphics master.
   - In M1 the dialogue audio passes through untouched, and runtime is unchanged.
8. **Output:**
   - MP4;
   - `timeline.json` (the source of truth);
   - the moment table (JSON + markdown);
   - the style spec;
   - a contact sheet;
   - the QA report;
   - a credits/attribution file.

### 2.3 Architecture: three levels plus the sandbox API

| Level | What | M1 set (minimal) | Who authors |
|---|---|---|---|
| **L1 primitives** | camera (2D pan/zoom; 2.5D dolly/orbit over layered planes), perspective, lighting/shadow, masks, typography (kinetic type, word highlight), easing curves, graphs (line/bar, axis draw), number count, compositing (layer over footage, speaker reposition/scale, blur/dim plate), particles (dust/glow) | All except particles and lighting, which are optional in M1 | Engineers. Typed, tested, deterministic. |
| **L2 blocks** | Designed sequences built from primitives, each with a params schema and word-anchored cues | 1 `financial_comparison` (chart grows; speaker stays visible) · 2 `word_highlight` (spoken figure or phrase lands on the word) · 3 `milestone_timeline` (2.5D camera move across milestones, full-frame cutaway, L-cut voice) · 4 `number_comparison` (A → B count-up beside the speaker) · 5 `name_title` (lower third, upgraded) · 6 `key_phrase` (pull-quote typography over a dimmed/blurred plate) · 7 `section_card` (chapter title with a camera push) | Engineers + design. Later: `newspaper_reveal`, `evidence_board`, `map_journey`, `portrait_reveal` (M2). |
| **L3 compositions** | Agent combines primitives and blocks for an unusual moment (for example the §2.6 sequence: chart → timeline dive → back to speaker) | Allowed in M1 through the sandbox API only, except in the unrestricted arm of the experiment | Director agent |

**Sandbox animation API** (constrained). The agent emits a JSON composition, not free code. Its parts:
- `layers[]` of L1 primitives and L2 block instances;
- `cues[]` anchored to **word ids** (`{wordId, offsetMs}`), not raw ms, so a re-timed voice re-times the graphics;
- a `layout` relative to the subject (`avoid: face`, `side: left|right|auto`, `speaker: keep|shrink|hide`, safe-area insets);
- `camera` keyframes;
- a `style` (brand palette, fonts drawn only from a licensed font manifest).

A validator rejects unknown types, out-of-range params, text not supported by the transcript or user facts, and fonts that aren't shipped. The **sandbox API compiles to Cinematic Skill**, the decided engine. It generates the engine's Python scene calls (word-keyed items, camera keys) from the validated JSON, so the same plan drives preview and export. The M1 harness wraps Cinematic Skill's scripts (`render.py` and friends) on the box, with no repo changes.

**Unrestricted-vs-constrained experiment (M1 only, internal):**
- **Constrained arm:** the sandbox API only (above).
- **Unrestricted arm:** the agent writes Cinematic Skill scene code directly (this is how the skill works natively).
  - It runs in an isolated process with no network, no secrets/env, a read-only asset dir, and CPU/time/memory caps.
  - Its output still has to pass every QA gate.
- **Same inputs, same model, same revision cap.** VQ blind-scores both arms. We also record failure rate, render time, tokens and determinism.
- **Product implication:** the live product's rule today is "no unrestricted LLM-generated render code" (`new-app/docs/ai-motion-graphics-integration.md`, per **[MG §3]**).
  - If the unrestricted arm wins clearly, we bring it to John as a decision, not as a default.
  - Either way, a winning unrestricted pattern can be promoted into a new L2 block (§4).

**Relationship to B0.5 / the live motion graphics:**
- The live path stays exactly as it is:
  - `new-app/lib/clips/motion-graphics/{contract,suggest,text-adapter,primitives,keyframe-adapter,safe-zones,text-fit}.ts`;
  - `lib/clips/editor/text-templates-catalog.ts`;
  - `lib/clips/render-plan/{motion,text-anim,text-items-ass}.ts`;
  - worker `motion_render.py`, `text_anim.py`;
  - libass preview.
- That includes the B0.5 epic #1119–#1124, which is still open.
- MGD is a **separate engine and product**. M1 does not change `ClipEditsV2.motionPlan`, `textItems` or the ASS burn path.
- Text-only B0.5 templates can later be wrapped as cheap "ASS-engine" L2 blocks. **Supersede vs coexist** is a later decision for John (§7 Q10).

**Visual reasoning:**
- The Director gets contact-sheet frames, face boxes and the safe area, not just text.
- It must state *why* a moment earns a graphic (`reason`) and *where* it sits relative to the speaker.
- Decisions come from the model reading the **whole transcript**. There are no hard-coded keyword or setting lists. If nothing fits, it reimagines the visual or omits it **[R standing rules, §3.6]**.
- Candidate face/framing sources to reuse inside the harness (whether their output works offline is **unconfirmed**):
  - worker `reframe_v2.py`, `reframe_core.py`, `subject_reframe.py`, `streamer/layout/detect_facecam.py`;
  - `new-app/lib/clips/editor/scene-detect.ts`, `lib/clips/facecam-geometry.ts`.

**Three-layer composition rule (John-endorsed, relayed by the CoS, 11:27 PM ET).** Every cinematic scene (INSERT, RETURN world, full-frame cutaway) has three layers:

| Layer | Holds | Examples |
|---|---|---|
| **Foreground** | The hero | photo, document, chart, diagram, key words |
| **Midground** | Supporting context | related objects, subtle annotations, secondary info |
| **Background** | The world | textured map, room, city silhouette, paper surface, subject atmosphere |

- **Backgrounds** come from reusable, **procedurally generated background systems**, styled per subject and chosen through the style spec (§2.5). Examples: finance = trading floor or financial paper; history = archival maps or worn paper; science = deep 3D space, particles or grids.
- **No image-gen call per scene.**
- OVERLAY moments on a talking head use the footage itself as the background. The layer rule applies to the graphic's own foreground/midground only.

**Design rule (John, relayed by the CoS, 11:27 PM ET):**
- **Never add background elements just to fill space. Simplicity must feel deliberate.**
- A giant animated number on dark is good; a tiny icon floating in emptiness looks unfinished.
- The director evaluates the **whole frame**, not just whether the hero graphic exists (QA A14, B9).

### 2.4 Master timeline, three capabilities, footage modes, and the editor boundary (John-endorsed)

**Master timeline.**
- One timeline with tracks:
  - **V1** primary picture (footage, inserts);
  - **V2+** graphic overlays (alpha);
  - **A1** narration/dialogue;
  - **A2** clip native audio;
  - **A3** music;
  - **A4** SFX.
- Graphics live on the timeline as **parametric segments** (style spec + moment + world-state reference) and render at preview/export time.
- **Do not render a fixed graphics video and splice footage into it.** A change to narration, a trim or a swap re-times or re-renders only the affected segments. Render results can be cached by parameter hash.
- **Reconciling with existing editor state:**
  - `ClipEditsV2` (`new-app/lib/clips/edits.ts`) already carries lane-like state: `timelineLanes`, `broll[]`, `textItems`, `motionPlan`, `audio`, `keyframes`, `transitions`, `audioMuteRanges`, `loudnessLufs`.
  - Ducking already exists in the worker (`audio_render.py` `build_audio_filter` / `export_ducked_music_stem`, used by `t2v/audio_duck.py`).
  - **M1:** a **`timeline.json` on the box (harness)** whose track and field names mirror those lanes, so it can port. M1 makes no change to `ClipEditsV2` or `RENDER_CLIP`.
  - **Post-Gate (outline):** an additive `ClipEditsV2` lane referencing MGD segments. `RENDER_CLIP` gains a pre-step that renders graphic segments and composites them as lanes; the exact hook is decided after Phase 0. The in-product timeline UI comes later (§4).

**Three capabilities** (each moment declares one):

| Capability | What | Where |
|---|---|---|
| **INSERT** | A code-rendered sequence on V1 where a graphic helps the story (e.g. the §2.6 milestone timeline cutaway). Voice may continue under it (L-cut). | M1 and M2 |
| **OVERLAY** | Animation on top of existing footage: figures, diagrams, labels. Must obey the face-safe layout (FR 3). | **The M1 talking-head case** |
| **RETURN** | A persistent virtual camera/world whose state is kept while footage plays, so graphics resume naturally. Example: dive into a photo, the photo becomes the real clip, then pull back out of the same photo. | **Default transition into footage** (John, ~11:45 PM ET). Proven on Cinematic Skill (§1.8). **Required in M1** and in M2. |

**World-state persistence (RETURN):**
- At world exit, save a `WorldState`:
  - camera pose (position, target, zoom/FOV, roll);
  - each object's transform and state (revealed, counter value, highlight);
  - the world animation clock;
  - the style-spec id.
- While footage plays, the world clock is frozen by default. A moment can opt in to "world keeps moving".
- At re-entry, restore the saved state exactly.
- **Frame-matched transitions:**
  - Entry: the last world frame's portal region (the photo plane) matches the clip's in-point frame.
  - Exit: the clip's out-point frame is mapped back into the same portal before the camera pulls out.
  - Tolerance is as in Phase 0 test 4.

**Both transition options, always (John decision, 10:47 PM ET):** *"In a perfect world, I would like the option of both… whatever would look better. We want to get to a point that the agent eventually can make that decision, whichever one's better, whether to cut or whether to do an overlay into it… But I want it to have the option of both."*
- For **every** transition into or out of footage, the director has two options:
  - (1) a **hard cut**;
  - (2) a **graphic-led transition**, either a RETURN dive-in or an overlay that carries into the clip.
- It picks per moment on **which looks better** and logs `transitionChoice` + `reason`.
- **End goal:** the agent decides autonomously. Until its choices agree reliably with Video Quality (see §2.10 criterion 10), Video Quality reviews every choice.

**Default: RETURN (John, relayed by the CoS, ~11:45 PM ET):** *"Nah, on both of them, the, the, the animating into the video looks way better. The cuts, the cuts are just too abrupt. I'm gonna be honest, the cuts are way too abrupt."*
- The animated push-in/pull-out is the **default** into and out of real footage.
- A **hard cut is the exception** (updated 11:48 PM ET, relayed by the CoS: *"it just looks better when you go in and out... there might be some times that a hard cut might be fine... if it's perfect, if it can line up exactly for that picture... if you got a video to take a screenshot of whatever screen, of the frame first, and then take a screenshot of the frame after... It looks more produced versus just slapping through and just slapping back."*).
  - It is **allowed only when the frames line up exactly**: the outgoing and incoming pictures align (a match cut).
  - The logged `reason` must **state the alignment**: which frames, and what lines up.
- This replaces the earlier "a hard cut is often right" wording.
- Both options stay available.
- QA check A12 now flags **unjustified hard cuts** and **poorly matched returns** (§2.8).

**Return craft rules (learned from the insert/return tests):**
1. **Frame-exact seams (required; John, 11:48 PM ET).**
   - For every return, the dive-in still **is** the clip's exact first frame, a frame grab at the chosen in-point. The pull-out starts from the clip's exact last frame, a frame grab at the out-point.
   - Both seams must match perfectly. No image-gen, user-photo or approximate stills at a return seam.
   - **Choose in/out points knowing they become the stills.** Avoid frames with motion blur, mid-blink faces, logos, lower thirds or tickers.
   - **Grab after processing.** The grab is taken after any crop, reframe, grade or grain is applied, so the still and the footage are identical at the seam.
   - **Exact indexing.** No off-by-one: decode-accurate seeking from the nearest keyframe (not keyframe snapping), with frame index computed from the timestamp and the source fps (including VFR/timebase handling). Log the frame indices.
   - Seam match is checked (A15).
2. **Packaged news matches poorly.** Clips with logos, lower thirds or tickers should be detected. In order of preference: pick clean in/out frames, crop or reframe the packaging out before the grab, or flag for review. A hard cut is only valid if it meets the exact-alignment rule above.
3. **Resolution.** 720p sources look soft next to code-rendered graphics (the Keef source was 1280×720). Prefer the highest-resolution source available and flag a resolution mismatch (A16).
4. **Continuity.** Carry the world's grade and grain onto the footage (and vice versa at the boundary), so sharpness and grade don't jump at the transition (A17).

**Talking-head M1 and RETURN.**
- An already-edited 60s talking head may have no natural dive-in. A return then needs an **inserted clip**, for example user-supplied footage the speaker refers to. The dive-in still and the pull-out are frame grabs from that clip's in/out points. A photo on its own is a photo hold, not a return seam.
- **Inserting footage or stills is a WHAT decision.** The director *proposes* it with a reason, and the footage editor or user approves it (boundary below).
- OVERLAY moments on the speaker stay as specified (face-safe).
- In M1 the approved insert runs as footage mode (b) under the speaker's continuing dialogue, so runtime is unchanged.

**Two footage modes** (an explicit editorial decision per clip, recorded in the beat table as `footage_mode` + `reason`). Audio levels below are PM proposals for VQ to tune.

| | **(a) Own audio, extends runtime** (60s → 90s) | **(b) B-roll under narration, runtime unchanged** |
|---|---|---|
| Use when | The clip's own sound or speech carries the point (a quote, a key moment, natural sound) | The picture illustrates what the narration says |
| Narration | Pauses; never overlaps clip speech. Resumes on a breath after the clip. A J/L lead or trail of ≤ 1s is allowed. | Stays primary and continuous |
| Clip audio | At dialogue level, normalized to the program loudness target (`loudnessLufs`) | Speech in the clip is **muted** (never two voices). Optional ambience bed about 20 dB under narration, off by default. |
| Music | Ducks deeper or fades under clip speech (about −20 dB under dialogue); may stay up under natural-sound-only clips | Ducks under narration as today (existing duck graph) |
| SFX | Sparse; never on top of clip speech | Under narration (about −12 dB), never masking a word |
| Program | Integrated loudness at target ±1 LU, true peak ≤ −1 dBTP | Same |

- **M1 (enhancement):** every moment is OVERLAY or an INSERT under continuing dialogue, which is mode (b)-equivalent. **Runtime is unchanged.** Mode (a) is exercised in M2.

**Boundary: the footage editor decides WHAT; MGD decides HOW.**
- **The footage editor owns the approved sequence:**
  - Story, multi-source Story, Clean Take and the editor;
  - which clips, their order, cut ranges, trims and transcript fixes.
- **MGD owns presentation:**
  - the style spec, graphics, capabilities, world/camera, transitions;
  - audio *mix* rules per footage mode.
- **MGD never** adds, removes, reorders or re-trims approved content, and never edits `trim`, `cutRanges`, `sectionOrder`, `wordFixes` or Clean Take review state.
- In M2 documentary mode, a footage mode (a) choice that extends runtime is a **proposal** on the editable timeline, which the user or footage editor approves before render.
- Integration means consuming the existing editors' output, not rebuilding them.

### 2.5 Style spec and variety (new requirement from John)
**Rule:** one **style spec** per video, chosen by the model from the **whole** script/transcript, the brief and the footage inventory, and built around **one anchor motif** **[SV §3.1, §5.2]**.
- It comes with a plain-language rationale: subject → honest materials → tone → world → motif.
- **No keyword-to-style lists** (rap → graffiti, crime → red string, school → chalk) **[SV §3.6]**.
- **No colour denylists.** A colour can be right when it is earned **[SV §5.3]**.
- If nothing supports a world, reimagine the world, not just the shot **[SV §5.2]**.

**Two layers [SV §1.7]:**
- **House constants** (the quality floor, never varied):
  - word-sync timing (±1 frame);
  - phone readability and contrast;
  - safe areas and face/caption avoidance;
  - easing and motion quality (no linear pops, no jerk);
  - honesty/fact rules.
  - Plus user-supplied brand items when present: logo, type family, face-cam layout, caption kit.
- **Episode world** (varies per video), with these axes from **[SV §5.1]**:
  1. layout grammar;
  2. camera grammar;
  3. motion language;
  4. material/texture;
  5. typography roles and behavior;
  6. motif and its recurrence rule;
  7. composition/grid;
  8. footage relationship (over, instead of, interview-first, screen-first);
  9. transition grammar;
  10. colour *function*;
  11. tone/stakes;
  12. sound language (if SFX).

**Distance check (PM proposal; thresholds are tuned in M1 by Video Quality and are never loosened just to pass, [SV §5.3, §6.7]):**
- **Counted axes:** 1–9 above.
- Colour function, palette, tone and sound language **do not count** on their own.
- A swapped background prop with the same layout, camera and motion counts as **no change** on material.
- **Pass** when two specs differ on **≥ 2 of the 4 core axes** (layout grammar, camera grammar, material/texture, motif) **and ≥ 4 of the 9 counted axes overall**.
- Colour-only or prop-only changes fail by construction. That is John's sentence made testable.

**Recent-output check:**
- The new spec must pass the distance check against:
  - (a) this user's last N episode worlds (proposed N = 5). House constants and an explicitly locked "series look" are excluded;
  - (b) a recent global sample of Transovo outputs (in M1: every earlier M1 output plus the Keef draft).
- **On fail:** regenerate the style spec, at most 2 times. That is a capped, logged, text-only LLM step, not a render retry. If it still fails, take the most distant candidate and flag it for human review.

**Background systems inside the episode world:**
- Procedural background systems (§2.3) are **per-subject families** with parameters for material, texture, depth, lighting, density and camera behavior. They are not one fixed background per topic.
- The style spec picks a family **and** its variant from the whole transcript.
- The distance and recent-output checks apply as usual. Two finance videos that both get the same trading floor with the same layout, camera and motion **fail**, the same as a recolour.
- No keyword-to-background table.

**Keef world:** the evidence-desk/map look is **one world among many, not the default**. It goes into the global sample so it can't become everyone's look **[SV §5.4]**.

**M1 worlds:**
- The engine needs at least 3 code-cheap worlds, for example:
  - evidence desk;
  - typographic stage;
  - paper/cutout or map/geo;
  - a clean UI/callout kit for tutorials **[SV §5.4]**.
- Each M1 L2 block must render in every M1 world through style-spec params (material, type behavior, camera language), not as per-world copies.
- Chalkboard is not an M1 world **[SV §6.9]**.

### 2.6 Worked example (also acceptance scenario S1)
**Line:** the speaker says: *"When I started, we were doing ten thousand dollars a year … we hired our first two people, moved into an office … three years later we crossed a million."*

| Time (output) | Words (anchors) | Graphic (block / primitives) | Layout vs speaker | On-screen text | Camera | Reason |
|---|---|---|---|---|---|---|
| 18.20–21.10 | "we were doing **ten thousand dollars** a year" | `financial_comparison` starts: axis draws, first bar rises · `word_highlight` | Speaker eases to the right ~58% of frame and stays visible; chart panel on the left, clear of the face box | **$10,000 / yr**, highlight lands on "ten" (19.04 ± 1 frame) | Static; slight push on the panel | Start of a growth story; the figure is the hook |
| 21.10–25.30 | "hired our first two people … moved into an office" | `milestone_timeline` (2.5D): full-frame cutaway, 2–3 milestone cards on a receding plane | Speaker off screen; voice continues (L-cut) | Milestones **only from spoken words** ("FIRST 2 HIRES", "OFFICE"). Years only if spoken. | Dolly across the timeline, card lands on its word | Turns a list into progress; nothing here needs the face |
| 25.30–29.60 | "three years later we crossed **a million**" | Camera pulls out of the timeline back to the speaker · `number_comparison` count-up | Speaker back at full size; number panel lower-left, outside face box and caption zone | **$10,000 → $1,000,000**, count finishes on "million" (28.70 ± 1 frame) | Pull-out transition, then still | Payoff: the comparison the viewer waits for |
| 29.60–36.00 | (reflection / emotional line) | **None (do not animate)** | Full speaker | — | — | The face and voice carry this line **[R §3.3, §3.5]** |

**Fact rule:** every number or label on screen must appear in the transcript (or in user-supplied facts). If the speaker never names milestones, `milestone_timeline` is omitted, not invented.

### 2.7 Functional requirements (M1)
1. Select 3–6 moments per 60s, or fewer. Each has a `reason`. At least one stretch must be "no graphic" when the content calls for it.
2. Word-anchored timing: every cue references a word id and resolves to output ms. Visual hits land within **±1 frame (≤ 33 ms at 30fps)** of the anchor word start.
3. Subject-aware layout: graphics never overlap the face box by more than 5% of the face area (except deliberate full-frame cutaways). They respect title/action safe areas and the caption zone.
4. No adjacent repeat of the same block. Max one full-frame cutaway per ~15s, unless the moment needs more (logged).
5. Style: every moment follows the video's approved style spec (§2.5). House constants and brand win over the episode world. Fonts come from the licensed manifest, and graphics sit well with the footage grade.
6. All on-screen facts are verbatim or normalised from transcript/user facts (for example "ten thousand dollars" → "$10,000"). The harness logs the source word ids for each text string.
7. **Both transition options available.** Every footage entry or exit can render as a hard cut or as a graphic-led transition. The director records `transitionChoice: 'cut' | 'graphic_led'` + `reason` for each one. This is required, not optional. **RETURN is the default; every hard cut needs a justifying `reason`.**
8. Every moment declares a capability (INSERT/OVERLAY/RETURN). Every added clip declares `footage_mode` + `reason`. The harness `timeline.json` is the single source of truth, and the MP4 is rendered from it.
9. Output: MP4 at the input resolution and fps, moment table, contact sheet, QA report, credits file.

### 2.8 QA gates (per moment, then whole clip)
**A. Automated (block the moment if failed):**
- **A1** contact sheet generated (3 frames per moment + 1 per 2s overall);
- **A2** black/frozen-frame detection (ffmpeg `blackdetect` / `freezedetect`, with intentional holds whitelisted by the plan);
- **A3** face overlap and safe area (face box vs graphic alpha mask);
- **A4** word-sync offset: cue time vs word timestamp, ±1 frame;
- **A5** phone legibility: rendered text x-height ≥ an agreed threshold at a 1080×1920 phone downscale and at 360p, plus contrast ratio ≥ 4.5:1 against the local background;
- **A6** motion smoothness: camera path jerk below a threshold, with no sub-frame stutter or pops;
- **A7** A/V sync is unchanged vs the input, and loudness passes through (no level change);
- **A8** duplicate-block check;
- **A9** every text string has source word ids;
- **A10** credits file present;
- **A11** the style spec passes the distance and recent-output checks (§2.5), and the motif recurs at least twice in the video;
- **A14** whole-frame composition heuristics. These flag for review rather than auto-fail, because taste wins (thresholds are PM proposals that VQ tunes):
  - **visual balance:** the luminance/saliency weight centroid is within the intended composition zone;
  - **hero scale:** the hero bbox is large enough relative to the frame for its role (flag, for example, a lone hero under ~5% of the frame area with large empty surroundings);
  - **negative space vs emptiness:** large empty areas are OK when the hero is dominant, but flagged when the hero is small and uncentred;
  - **layer separation and depth:** foreground, midground and background differ in scale, blur, parallax or contrast, read from the scene metadata;
  - **lighting coherence:** one key-light direction across the layers, with shadows consistent with it;
  - **typography hierarchy:** at most 3 text sizes on screen, with a clear size step between levels;
- **A12** transition exceptions (**rewritten, ~11:45 PM ET**):
  - flag any **hard cut into or out of footage whose `reason` doesn't state an exact frame alignment**;
  - flag any **return whose seam is not near-identical** (fails A15).
  - Return over-use is no longer the risk.
  - RETURN boundaries are still checked with the Phase 0 test 4 metrics (SSIM, no flash, state equality);
- **A15** return seam check (frame-exact, 11:48 PM ET):
  - compare the dive-in still with the decoded in-point frame, and the out-point frame with the pull-out start, after crop/reframe/grade;
  - the target is **near-pixel-identical** (threshold for VQ to tune, e.g. SSIM ≈ 1.0 or PSNR ≥ a high bound);
  - verify that the logged frame indices equal the decoded frames (no off-by-one);
  - also detect packaging and motion blur or blinks in the chosen frames, and flag them;
- **A16** resolution mismatch: flag inserted footage below the output resolution (e.g. 720p in a 1080p film) or visibly softer than the adjacent graphics;
- **A17** grade/sharpness continuity: measure the colour stats, sharpness and grain delta across each transition boundary, and flag jumps above a VQ-tuned threshold;
- **A13** footage-mode audio: in mode (b) no clip speech overlaps narration; in mode (a) narration doesn't overlap clip speech; program loudness and true peak are on target.
- These are adapted from Video Director's `check_timeline` / `qa_video` (freezes, flashes, illegible type, "nothing moving") **[R §1.7]**.

**B. Video Quality review (rubric, 1–5 each), using its charter `roles/08-video-quality.md`:**
1. Is the hero of each graphic immediately understandable?
2. Is it readable on a phone?
3. Is the camera smooth and motivated?
4. Do the graphics support the spoken words at the right moment?
5. Are they visually integrated (face clear, grade/style matched)?
6. Does it look professionally designed, not like PowerPoint?
7. Did any graphic fail to improve its moment? (If yes, it should have been omitted.)
8. Does the video's world fit its subject and tone, with a motif that holds?
9. **Whole frame:** is it balanced, with the hero at a confident scale, negative space that feels intentional (not empty), clear depth across the three layers, coherent lighting and a clear type hierarchy? Was anything added just to fill space?

**Rule:** if a graphic doesn't improve the moment, omit it.

### 2.9 Test set
- **4–5 real, authorized 60s already-edited talking heads.** Pick from the VQ benchmark library `video_quality/benchmark/v1` (16 on-disk talking-head/retake sources, 16 interviews; 3 Clean Take exports already edited).
- The set should include:
  - at least one with a spoken **number or growth claim**, needed for S1 (if none exists, we ask John to supply or record one; §7 Q9);
  - one instructional/steps clip;
  - one emotional/story clip where the right answer is mostly **no graphics**;
  - **recommendation:** one **tutorial-style** clip (face cam in a box plus a screen recording or graphics) as an **optional/stretch** M1 item, if authorized footage exists in the library. If not, tutorials move to M2.
- **Every M1 test clip must include at least one natural dive-in moment** (RETURN is required). If a 60s talking head has none, the test includes an **approved inserted clip** for it, user-supplied or licensed. Its return seams are frame grabs at the in/out points.
- Third-party copyrighted material (as in the Keef/GameStop tests) is internal test material only and never appears in product or marketing output.
- Licensing status per clip comes from the benchmark manifest.

### 2.10 Benchmark and acceptance criteria (M1)
1. **Blind comparison.** For each test clip, VQ plus at least one human reviewer (John or his nominee) rank:
   - (a) the edit with no graphics;
   - (b) the edit with today's AI motion plan (`suggest.ts` → `text-adapter.ts`), rendered once on existing paths, internal and frugal;
   - (c) the MGD output, constrained arm;
   - (d) the MGD output, unrestricted arm.
   - **Pass:** (c) or (d) ranked first on ≥ 4 of 5 clips, and the VQ rubric item 6 ("pro, not PowerPoint") averages ≥ 4.0.
2. **S1 worked example** renders as specified in §2.6: speaker visible during the chart, highlight on "ten", 2.5D timeline move, return to the speaker with the count-up finishing on "million". All ±1 frame.
3. All automated gates A1–A10 pass on final renders (or are explicitly whitelisted holds).
4. Zero on-screen facts without transcript or user source.
5. Determinism: re-rendering the same plan gives identical frames.
6. Render time per 60s recorded, with LLM tokens per clip recorded (internal, not shown to users).
7. **Style variety.**
   - Across the N ≥ 4 M1 test videos, every pair of style specs passes the §2.5 distance check, and no spec is too close to the Keef draft.
   - In a blind review of stills plus 10s excerpts, Video Quality judges that the videos **do not look the same**, with ≤ 1 pair flagged "same look, different colour or props".
   - The house constants (sync, legibility, safe areas, easing) still pass on every video.
8. **Master timeline.**
   - The final MP4 is rendered from `timeline.json`.
   - Changing one moment's text or timing in `timeline.json` re-renders only that segment, and the rest of the video stays frame-identical.
   - No pre-baked graphics master is used.
   - M1 runtime equals input runtime (±1 frame).
   - A12 and A13 pass.
   - **Every return** meets the Phase 0 test 4 criteria plus A15–A17. Both seams are frame grabs at the logged in/out indices and pass the near-identical seam check. Every hard cut's reason states an exact alignment.
9. **Both transition options (M1).**
   - The harness renders both a hard cut and a graphic-led transition. For example, an overlay carries into a cutaway, or the camera dives in and out of the §2.6 timeline INSERT.
   - On every test clip with a natural dive-in moment, the moment is rendered **both ways**. Video Quality compares the two blind, and the result calibrates the director's choice.
   - **RETURN is required in M1** (John, ~11:45 PM ET). Every test clip has at least one return into footage, where an inserted still or clip enables it (WHAT, approved). Each return is rendered both ways (return vs hard cut) for VQ comparison. Hard cuts appear only as justified exceptions.
10. **Decision quality.** On every transition in the M1 set, Video Quality records whether it agrees with the director's choice, **measured on the exceptions**: was each hard cut (the exception to the RETURN default) justified, and was each return that VQ would have cut flagged? The agreement rate is reported; the target is ≥ 80%, a PM proposal. Below target, Video Quality keeps reviewing every choice and the disagreements go back into the director brief. The director doesn't drop to one default.
11. **Composition.**
   - Every cinematic scene has the three layers, with a procedural background (no per-scene image-gen).
   - A14 flags are resolved or justified.
   - VQ rubric item 9 averages ≥ 4.0. Composition is judged before transition variety.
12. **Boundary.** The M1 output's dialogue picture order, cut points and transcript match the input edit exactly. The only picture additions are director-proposed inserts (stills or clips for a return) that the footage editor or user approved, logged as WHAT decisions.
13. Protected behavior: no change on master or production. Proved by the repo diff being empty for this work.

### 2.11 Constraints, protected behavior, failure, logging, tests, release (M1)
- **Constraints:**
  - box/harness only;
  - no AI video;
  - no AI images in M1 by default (Parallax Doc's image generation is off);
  - no production keys beyond an approved LLM key used from the box env (never printed);
  - frugal: one LLM plan plus ≤ 2 revision rounds per moment per run, and no automatic re-runs of a failed paid call.
- **Protected:**
  - upload clipping, stream clipping, the editor, Story, multi-source Story, Clean Take;
  - the footage editor's ownership of WHAT (§2.4 boundary): MGD never mutates Story, multi-source Story, Clean Take or editor outputs;
  - B0.5 (#1119–#1124) and the assistant registry (`new-app/lib/clips/editor-commands/*`, #1114–#1117);
  - SMS worker / app3 untouched;
  - no repo commits.
- **Failure:** a moment that fails QA after its revision cap is **dropped**, not shipped. If the clip is left with zero good moments, report that honestly. A renderer crash fails that clip's run and is logged; there is no silent fallback to a different engine.
- **Logging:** run id, input hash, model id, tokens, each moment `{id, words, block/primitives, layout, reason, revision count, QA results}`, render timings, engine SHA. No secrets, cookies or signed URLs.
- **Tests:**
  - unit tests for the validator (rejects unknown types, out-of-range params, unsourced text, unshipped fonts);
  - word-anchor resolution;
  - face-overlap math;
  - determinism;
  - golden-frame tests for the 7 M1 blocks.
- **Release condition:** an M1 report to the CoS → John. It contains renders, the blind-comparison table, QA reports and the experiment results.

---

## 3. Gate: John reviews renders — **PASSED (14 Nov 2026, 11:51 PM ET, relayed by the CoS)**
John watched the insert/return renders and said: *"that looks way better... The from in and out looks like it's a part of the actual documentary... yeah, I think this is something we gonna, we need to build. I've already told you and gave you what we should build and how it should be, the UI and how the workflow should be. Now, I hope you gave it everything we gave it and not just some condensed version, so it's gonna give me like a shell of what I told it to be built."*
→ Build is approved. The full build spec is in **`specs/transovo-studio-build.md`**. (Original gate text: nothing in §4 started until John liked the renders.)

---

## 4. Later phases → **superseded by `specs/transovo-studio-build.md`**
> The detailed spec now lives in `specs/transovo-studio-build.md` (documentaries only; tutorials and other formats are later / Motion Studio, see `specs/motion-studio-vision.md`). The outline below is kept for history; where they differ, the build spec wins.

**M2: faceless documentary segments (same engine).**
- **Input:** the user's script and/or voiceover plus optional footage.
- **Planner:** narration-driven. Per line it chooses among:
  - footage (uploaded, or stock via the existing T2V matcher);
  - photo hold with optional gentle move (or **no** move);
  - cinematic board (map / prints / clippings / headlines / timeline / evidence board);
  - diagram;
  - interview/clip playback;
  - **do-not-animate** **[R §5.1]**.
- **Heuristics as model guidance and QA, not clamps** **[R §3.6]**:
  - cut picture to the voice **[R §3.1]**;
  - stills typically 5–20s, avg ~12s, never 1–2s flashes **[R §3.2]**;
  - hold the interview through a complete thought; prefer a visible jump cut to mismatched stock; leave breaths; J/L cuts **[R §3.3]**;
  - breathing room at section boundaries; motion needs a reason **[R §3.5]**.
- **Reuses the existing T2V/Prompt-to-Video pipeline** (flag-off, Appendix A):
  - pacing: beat ranges with documentary tempo 1.1 in `t2v-pacing.ts`;
  - no-repeat hard rule plus dHash in `t2v-no-repeat.ts`;
  - plan QA in `t2v-qa.ts`;
  - matcher in `stock-match*.ts` / `t2v-footage-agent.ts`, including photo fallback;
  - `assemble.py` frame-exact xfade/Ken Burns;
  - ElevenLabs TTS with alignment, if TTS is in scope (§7 Q4).
- **Honesty:** never present AI stills or footage as evidence of real events or people. Ship a credits/attribution file **[R §3.4, §4.4]**.
- **Master timeline in M2:** INSERT, OVERLAY and RETURN all ship. Footage mode (a) or (b) is chosen per clip with a reason, using the §2.4 audio rules.
- **AI video:** off by default, or a separate capped credit option for John to decide. Keep Wan-class generation off the default meter.

**Full product** (own product, decided in principle):
- An editable Transovo timeline that the user approves before render. No flat-MP4-only output, no auto-posting, no avatars **[R §5.1]**.
- Moment/beat table UI, a swap/hold/omit per moment, and the compact/full editor handoff as in Ad Studio (`docs/contracts/ad-studio-v1.md` §4–6).
- Its own nav link, outcome card and landing page (PRODUCT_V1 §1b).
- Credits estimate and confirm before paid steps.
- Data model and tables in Appendix B.

**Later-phase priority (John, relayed by the CoS):** first, make Cinematic Skill generate complete, subject-specific compositions (backgrounds, depth, lighting, camera, typography); then grow the background-system families; then add more transitions and animations.

**Engineering question (later phase; PM doesn't decide the HOW):** Cinematic Skill is Python + skia-python + ffmpeg, which suits the existing clips worker's language. Engineering should decide among:
- running it inside `worker/clips_worker` as a new job type;
- running it as a separate render service;
- running it on dedicated render boxes.

The deciding factors are dependencies (skia wheels, fonts), CPU/memory per render (§1.6), isolation for agent-written scene code, and the `RENDER_CLIP` hook. The SMS worker and app3 stay untouched whatever is chosen.

**Block promotion / library growth:** L3 compositions that pass VQ repeatedly get promoted to L2 blocks with schemas and golden tests. The unrestricted-arm winners from M1 are candidates.

**10–30 min documentaries:**
- Cinematic scenes are beats of 20–60s, not one long board **[R §5.3]**.
- Chunked render, then stitching.
- First public length target per Researcher: 10–15 min **[R §5.1]**. 30 min waits on measured render/QA.

**UX: "Transovo Studio" (John's concept, verbatim in `specs/documentary-studio-ux-concept.md`; after the Gate only)**
- **First screen:** one prompt box plus three starts: **Start with idea / Use a script / Edit my footage**, plus "My projects". No timeline or settings.
- **Project setup (minimal):**
  - length (3 / 5 / 10 / 15 min; **first release offers up to 5 min**);
  - visual direction (an *intent input* to the style spec, never a fixed look; the distance checks still apply);
  - voice (AI voice or upload own; TTS scope is §7 Q4);
  - format (16:9 · 1080p);
  - media (uploads + licensed assets).
- **One workspace:**
  - left: Project (Story, Media, Scenes, Graphics, Audio) plus the **AI Director chat**;
  - center: preview;
  - right: a **contextual inspector** (chart, photo or clip controls);
  - bottom: a **storyboard ⇄ timeline** toggle;
  - mobile: tabs.
- **Six stages in one project**, with an optional checkpoint after story + visual plan or a fully automatic run. Mapped onto this spec:

| Concept stage | Maps to |
|---|---|
| 1 Develop the story | **Edit my footage:** the footage editor (Story, multi-source Story, Clean Take, editor) decides WHAT (§2.4 boundary). **Idea / script:** M2 narration and beat planning. AI-written scripts are a new capability (see conflicts). |
| 2 Prepare footage and assets | Transcription (`MEDIA_TRANSCRIBE`), shot/face analysis (§2.2 step 2), licensed sources only (§5 R1) |
| 3 Direct the documentary | Style spec (§2.5), then moment design, capabilities, footage modes and both transition options (§2.4) |
| 4 Generate motion graphics | Cinematic Skill through the sandbox API, three-layer composition, sample-frame QA plus capped self-review (§2.2 steps 5–6, §2.8) |
| 5 Assemble and mix | Master timeline and footage-mode audio rules (§2.4) |
| 6 Review and export | QA gates plus VQ review; MP4 export, or open in the advanced (full) editor (Ad Studio handoff pattern) |

- **Storyboard cards:** one per visual moment (time, title, treatment, source type). **Per-scene regenerate only, never the whole film**, which matches segment-level re-render (§2.4).
- **Footage linking:** approach → play footage → return, linked on the master timeline, **with ordinary cuts when better** (John's "option of both", 10:47 PM ET).
- **Conversational edits:** the AI Director shows **proposed changes** that the user accepts. This reuses the diff/undo pattern of the assistant registry (#1114–#1117).
- **Two modes:**
  - *documentary from an idea* (more research, narration and code-rendered visuals);
  - *documentary from uploaded media* (more footage and editorial assembly, with graphics only where they improve the story).
- **Licensing:** never silently treat an arbitrary online clip as cleared. Only uploads and licensed sources are used (§5 R1–R2). Without licensed footage, the fallback is verified archival photos, illustrations, diagrams, maps and typography.
- **Cost display:** an **estimated minute/credit allowance before full render, with no dollar amounts**. It shows which operations are included, and code-rendered revisions are not framed as expensive generation (hard rule; §7 Q14).
- **First public release:** 5-minute documentaries; 10–30 min later.

**PM template, later phases (outline):**
- **Problem/persona:** as above.
- **Workflow:** plan → approve → render → edit.
- **FRs:** beat table, editability, credits confirm.
- **Constraints:** additive tables, credits only, no auto-paid retries.
- **Protected:** all modes plus B0.5 plus Ad Studio.
- **Failure:** per-moment retry as a new confirmed attempt; no charge for failed work.
- **Logging:** per beat `{type, reason, source, licence}`.
- **AC/tests/release:** to be written after the Gate.

---

## 5. Risks
1. **Licensing (stock and third-party clips):** the Keef and GameStop insert tests used copyrighted clips (an official music video, a CNBC broadcast). They are **internal test material only**, never product or marketing output.
   - Pixabay's terms (20 Oct 2026) prohibit unauthorized data mining/ML use and compiling content to replicate a competing service. Researcher concludes that a **persistent index** needs written permission **[R §4.4]**.
   - Our existing path (`/api/clips/broll/search` → `new-app/lib/server/ai/pixabay.ts`, 24h `BrollSearchCache`, `StockAsset` copies) needs a **John + Security review** against those terms. This spec does **not** change existing behavior.
   - Pexels isn't issuing new keys **[R §4.4]**. `lib/server/ai/pexels.ts` exists, but v1 must not depend on a new key.
2. **Archival/photo rights and fake evidence.**
   - Commons metadata can be wrong.
   - AI stills must never stand in for real people or events.
   - Mitigation: a credits file and the honesty rules in the Director brief.
3. **Hallucinated on-screen facts.** Mitigation: the source-word-id rule (FR 6, gate A9), and a "reported" tag when the user marks a claim as reported.
4. **Render time.**
   - 60s is likely fine. 15–30 min is unmeasured on Hetzner **[R §6.5]**.
   - Cinematic Skill's README: 92s at 1080p took ~6 min on a laptop **[R §1.2]**.
   - The Phase 0 measurement (§1.6) gates M1.
5. **Engine dependency (decided: Cinematic Skill).**
   - It is a young, single-maintainer agent skill, built as a short-film workflow and not a 10–30 min editor **[R §1.2, §5.3]**.
   - Mitigations: vendor a pinned SHA; wrap it behind the sandbox API so the engine stays swappable; measure render time (§1.6).
   - Fonts, Piper voices and Commons asset licences still need checking.
   - HyperFrames and Remotion are not chosen (Remotion would carry a licence cost at ≥4 people **[R §1.8]**).
6. **Unrestricted code execution.** This is a security risk if it ever leaves the sandbox. It stays internal to the M1 experiment, and production use needs John and Security.
7. **LLM agent cost.** Vision review plus revisions per moment. Capped; tokens measured in M1.
8. **Conflicting earlier decisions.**
   - PRODUCT_V1 §8 lists "script-to-video" and "AI motion-graphics packs" as Not planned.
   - B0.5 was decided as "10 templates on the current engine, no phase-2 engine".
   - This product needs John to confirm it supersedes those for MGD only (§7 Q10).
9. **Young prior art.** Cinematic Skill (now the base engine) is about 5 days old **[R §1.1, §5.3]**. Vendor the ideas and pinned SHAs, not live installs.
10. **Matcher quality (M2).** A beautiful fallback doesn't fix poor stock matches. The T2V matcher diagnosis work stays on the critical path **[R §5.3]**.
11. **Variety vs quality floor.** Pushing for distinct worlds can produce weaker or off-tone looks. Mitigations:
    - house constants are never varied;
    - VQ rubric item 8;
    - a human look-approval gate stays in the product **[SV §5.3]**.
12. **Repetition creep.** A successful look (for example the Keef desk) quietly becomes everyone's default, or the model falls back to a few worlds. Mitigations:
    - the global-sample distance check;
    - the variety metric in §6;
    - an engine that can express many worlds, which we test in Phase 0.
    - A numeric distance can't judge taste, so blind VQ review stays **[SV §5.3]**.
13. **RETURN complexity.**
    - Frame-matching portals, saving and restoring world state, and freezing the clock are the hardest engineering in this spec. They can produce visible pops or state drift.
    - Mitigations: prove it in the running insert/return test on Cinematic Skill (§1.8) before M1 depends on it; RETURN is now default and required in M1, so A12 (unjustified cuts, poor matches) and A15–A17 (match, resolution, continuity) carry the quality load. Packaged or low-res sources get cleaner in/out frames, a crop or reframe, or a review flag. A hard cut is only valid with an exact alignment.
14. **Render time with a persistent world.** Evidence so far: the insert tests reused all but about 2.4–4s and took about 15–22 min wall-clock for those partial renders (as reported, §1.8).
    - Re-entering a world means re-rendering world segments with restored state, and a long documentary with many returns multiplies render time.
    - Mitigations: segment-level caching by parameter/state hash; measure in §1.6 with a RETURN segment included.
15. **Positioning.** A "faceless channel machine" carries brand/YouTube risk **[R §5.3]**.

## 6. Success metrics
- **M1 (proof):**
  - blind-comparison win rate (target: MGD first on ≥ 4/5 clips);
  - VQ "pro, not PowerPoint" average ≥ 4.0;
  - 0 unsourced facts;
  - 100% word-sync within ±1 frame;
  - render minutes per finished minute;
  - tokens per clip;
  - QA gate first-pass rate;
  - constrained vs unrestricted deltas;
  - **decision quality:** how often Video Quality agrees with the director **on the exceptions** (justified hard cuts vs the RETURN default; returns VQ would have cut), overall and per transition type. Also the A15 match pass rate. This is the gate to letting the agent decide on its own;
  - **style variety:** median count of differing counted axes between specs, the share of specs passing on the first try, and the VQ "look the same" flag rate.
- **Composition:** VQ rubric item 9 average, A14 flag rate per scene, and the share of scenes with all three layers. This is the leading M1 quality metric.
- **Product variety (post-Gate):** distance of each new spec from the user's last 5 and from the global sample, tracked over time to catch repetition creep.
- **Product (post-Gate):**
  - share of moments accepted unchanged vs swapped/omitted;
  - export rate per project;
  - publish/keep rate;
  - render success rate;
  - render time per minute;
  - support tickets on mismatched or illegible graphics;
  - credit burn per finished minute (internal).

## 7. Open questions for John
1. **Credits per finished minute or per moment.** No price is proposed here. Inputs are in Researcher's internal full-burn cost model **[R §4.2–4.3]**, which is internal math only; the UI stays credits-only. Also: is AI-video fallback off entirely, or a separate capped credit option?
2. **Product name, nav and landing.** It is decided as its own product. Which outcome card and slug, and when (post-Gate)?
3. ~~Max length for the first public version~~ **Resolved:** the first release is 5-minute docs, per John's UX concept (§9 of `documentary-studio-ux-concept.md`). 10–30 min comes later. Researcher had suggested 10–15 min.
4. **Is TTS in scope for M2?** ElevenLabs TTS with alignment exists in the flag-off T2V path. Or user voiceover only?
5. **Headcount** (determines Remotion Free vs Company licence) **[R §6.1]**.
6. **Unrestricted agent render code in production:** allowed if it wins the M1 experiment, or constrained API only?
7. **Pixabay/Pexels:** OK to open a John + Security review of the existing B-roll cache against the Pixabay terms?
8. **Competitor pricing discrepancies** (Fliki, InVideo Max, AutoShorts unverified **[R §6.2–6.4]**): verify before credits are set?
9. **M1 footage:** can you supply or record a 60s talking head with a real growth figure, and name one human reviewer for the blind test?
10. **Earlier decisions:** confirm MGD supersedes PRODUCT_V1 §8 ("script-to-video", "AI motion-graphics packs" Not planned) and the B0.5 "no phase-2 engine" decision **for this product only**, with B0.5 staying live and unchanged.
11. **Premium voice for test renders:** OK to spend on an ElevenLabs premium voice for the bake-off and M1 renders? It is pending your OK; nothing is spent until you say so.
12. **Series look vs a new world per episode:** should users be able to lock a series look (sports-package model) as an explicit choice, and how often should that be the default **[SV §6.6]**?
13. **Mode (a) runtime (still open):** a clip that plays with its own audio extends the runtime. Is that a director proposal the user or footage editor approves (as currently specified), or something else?
14. **Cost display (resolved by the hard rule, pending your confirmation):** your concept suggests "an estimated production cost". It is specified as an estimated **minute/credit allowance with no dollar amounts**. OK?
15. **Idea-only mode writes the script.** The AI researches and writes the script and proposes chapters. That conflicts with three things: the hard rule *"don't assign story angles in AI editorial prompts"*, Researcher's fact-checking risk **[R §5.3]**, and PRODUCT_V1 §8 ("script-to-video" Not planned; see Q10). How far may the AI go: user's script only, outline only, or a full draft behind a review gate with source links?
16. **"Identifies people and objects" in uploads.** Identifying people (face recognition) is a new capability with privacy and consent implications. Objects and shots only, or people too after a Security review?
17. **AI-invented graphics** ("a coding agent… can invent a neural-network animation"). This matches the unrestricted arm; production use is Q6.

**Closed:**
- *Cut vs graphic-led transition, and whether RETURN is optional in M1* was resolved by John at 10:47 PM ET: the director has both options, picks on which looks better, and Video Quality reviews until the agent is reliable (§2.4). **Updated ~11:45 PM ET:** RETURN is the default and is **required in M1**. Hard cuts are justified exceptions.

---

## Appendix A: Repo findings (`703deuce/sms` master `05ac1600`, read-only)

**Exists on master:**
- **T2V / Prompt-to-Video ("AI Video"), flag-off.**
  - Flag: `NEXT_PUBLIC_AI_VIDEO_ENABLED`, default off, in `new-app/lib/features/t2v.ts`.
  - Pipeline in `new-app/lib/server/t2v/pipeline/`: `t2v-orchestrator.ts`, `t2v-scene-planner.ts`, `t2v-story-agent.ts`, `t2v-footage-agent.ts` (photo fallback), `t2v-pacing.ts` (beat ranges; `documentary` tempo 1.1), `t2v-no-repeat.ts` (hard no-repeat, dHash), `t2v-qa.ts` (pre-render plan QA), `t2v-reimagine.ts`, `t2v-ai-broll.ts`.
  - Matcher: `lib/server/t2v/stock-match.ts`, `stock-match-llm.ts`, `stock-match-vision.ts`, `visual-query.ts`.
  - Routes: `/api/t2v/*`; pages `/app/ai-video/new`, `/app/ai-video/[projectId]`.
  - Worker in `worker/clips_worker/t2v/`: `assemble.py` (frame-exact normalize, Ken Burns `zoompan`, xfade transition map, VO concat), `titles_ass.py`, `elevenlabs_tts.py`, `tts_alignment.py`, `verify_stock.py`, `audio_duck.py`.
  - Job types: `T2V_ASSEMBLE`, `T2V_SCENE_AI_IMAGE`, `T2V_SCENE_AI_VIDEO`, `T2V_VERIFY_STOCK` (`worker/clips_worker/job_types.py`).
  - Build spec: `docs/t2v/SPEC.md`.
- **Stock B-roll:**
  - `GET /api/clips/broll/search` → `lib/server/ai/pixabay.ts` (+ `BrollSearchCache`);
  - `lib/server/ai/pexels.ts`;
  - `lib/clips/broll.ts`, `lib/server/clips/broll-auto.ts`;
  - worker `broll_render.py`.
- **TTS:**
  - `lib/server/ai/elevenlabs-tts.ts`, `/api/t2v/voices*`;
  - `/api/clips/clips/[id]/voiceover`;
  - `lib/server/ad-studio/voiceover.ts`.
- **Transcription:**
  - `MEDIA_TRANSCRIBE` job, `lib/server/clips/transcript.ts`, `media-transcripts.ts`;
  - `ClipWord` in `lib/clips/edits.ts`.
- **Editor state:** `ClipEditsV2` (`lib/clips/edits.ts`; `textItems`, `motionPlan`, `broll`).
- **Motion graphics (live engine, ASS/libass):**
  - `lib/clips/motion-graphics/*` (`contract.ts`, `suggest.ts`, `text-adapter.ts`, `primitives.ts`, `keyframe-adapter.ts`, `safe-zones.ts`, `text-fit.ts`);
  - `lib/clips/editor/text-templates-catalog.ts`;
  - `lib/clips/render-plan/motion.ts`, `text-anim.ts`;
  - worker `motion_render.py`, `text_anim.py`, `track_motion.py`;
  - libass preview components.
  - **Inferred:** `text-adapter.ts` still lists the older 9 text-backed types, so the B0.5 10-template compiler rewrite (#1120) does not appear to be on master yet.
- **Assistant command registry:** `lib/clips/editor-commands/{types,schemas,apply,index}.ts` plus `docs/contracts/editor-command-registry-v1.md` (10 Phase 1 commands).
- **Render:**
  - `RENDER_CLIP` (`worker/clips_worker/render_job.py`, `render_clip.py`, `render_pipeline.py`);
  - `RENDER_SCRIPT_COMPOSITION`.
- **Story / multi-source Story:**
  - `lib/ai-producer-agent/multi-source-story.ts`, `story-finisher.ts`;
  - `lib/server/ai-producer-agent/run-multi-source-story.ts`;
  - `/app/video-editor/[projectId]/story/[clipId]`.
- **Clean Take:**
  - `lib/ai-producer-agent/clean-take.ts`;
  - `lib/server/ai-producer-agent/run-clean-take.ts`;
  - `app/ai-producer-agent/clean-take/page.tsx`.
- **Framing / faces / shots:**
  - worker `reframe_v2.py`, `reframe_core.py`, `subject_reframe.py`, `streamer/layout/detect_facecam.py`;
  - `lib/clips/editor/scene-detect.ts`, `lib/clips/facecam-geometry.ts`;
  - `BG_MATTE_PREVIEW` job.
- **Ad Studio** (landed): `AD_STUDIO_RUN`, `lib/server/ad-studio/*`, `/api/ad-studio/*`, `/app/ad-studio`.
- **Runtimes:** `new-app/package.json` has **no** Remotion, Lottie or Three.js (Playwright only).

**In flight (open):**
- B0.5 epic #1119 with #1120–#1124.
- Assistant #1114–#1117.
- No open PR touches motion graphics or documentaries. Open clip PRs: #1191 (clipper deadlock), #1178, #1182 (templates batches).

**Not found (new):**
- No `documentary`, `parallax`, `cinematic` or `ken burns` product code. (`worker/prototype/v3/director.py` is a reframe layout prototype, unrelated.)
- No 2.5D / camera-over-board renderer.
- No subject-aware graphic layout.
- No word-id-anchored cue model.
- Cinematic Skill (the decided engine) is not in the repo; it is a box copy at `/workspace/code_motion_cinematic/repo` (commit `bf435561`).
- The box-only test projects are outside the repo: `/workspace/code_motion_test`, `code_motion_cinematic`, `code_motion_parallax`, `code_motion_ref`.

## Appendix B: Data model (M1 harness format, then post-Gate tables)

**M1 `MotionMoment` (harness JSON):**
```ts
{ id: string, words: { fromWordId: string, toWordId: string }, startMs: number, endMs: number,
  kind: 'block' | 'composition' | 'none',
  block?: { type: 'financial_comparison'|'word_highlight'|'milestone_timeline'|'number_comparison'|'name_title'|'key_phrase'|'section_card', params: object },
  composition?: { layers: Layer[], camera: CameraKey[] },          // L3, sandbox API
  cues: Array<{ wordId: string, offsetMs: number, action: string }>, // word-anchored
  layout: { speaker: 'keep'|'shrink'|'hide', side: 'left'|'right'|'auto', avoid: ['face','captions'], safeInset: number },
  onScreenText: Array<{ text: string, sourceWordIds: string[] }>,   // FR 6
  capability: 'insert' | 'overlay' | 'return',
  transitionIn?: { choice: 'return' | 'cut', reason?: string /* required when 'cut': states the exact frame alignment */,
                   inFrameGrabRef?: string, inFrameIndex?: number,      // return: dive-in still = exact in-point frame (post crop/grade)
                   seamScore?: number, alignmentFrames?: { outgoing: number, incoming: number } /* cut */ },
  transitionOut?: { choice: 'return' | 'cut', reason?: string, outFrameGrabRef?: string, outFrameIndex?: number, seamScore?: number },
  footageMode?: 'own_audio_extends' | 'broll_under_narration', footageModeReason?: string,  // when a clip is involved
  worldStateRef?: { worldId: string, exitStateId?: string, entryStateId?: string },       // RETURN
  reason: string, revisions: number, qa: Record<string, boolean|number> }
```
**M1 `StyleSpec` (harness JSON, produced before moments):**
```ts
{ id: string, rationale: string,
  house: { syncTolFrames: 1, minTextPxAtPhone: number, minContrast: 4.5, safeArea: object, easing: 'quality'|..., brand?: { logo?, typeFamily?, faceCamLayout?, captionKit? } },
  world: { layoutGrammar: string, cameraGrammar: string, motionLanguage: string, material: string,
           typography: { family: string, roles: Record<'title'|'label'|'quote'|'data'|'stamp', { weight: number, behavior: string }> },
           motif: { name: string, recurrence: string }, composition: string, footageRelationship: string,
           transitionGrammar: string, colorFunction: Record<string,string>, palette: string[], tone: string, sound?: string },
  distance: { vsUserRecent: number[], vsGlobal: number[], passed: boolean, regenerations: number } }
```
**M1 `timeline.json` and `WorldState`:**
```ts
Timeline { version: 1, fps: number, durationMs: number, styleSpecId: string,
  tracks: { V1: Segment[], V2: Segment[], A1: AudioSeg[], A2: AudioSeg[], A3: AudioSeg[], A4: AudioSeg[] } }
Segment { id, startMs, endMs, kind: 'footage' | 'graphic', source?: { mediaId, inMs, outMs }, momentId?, transitionIn?, transitionOut? }
AudioSeg { id, startMs, endMs, source, gainDb, duck?: { under: 'A1' | 'A2', depthDb: number } }
WorldState { id, worldId, styleSpecId, atMs, camera: { pos: [x,y,z], target: [x,y,z], zoom: number, roll: number },
  objects: Array<{ id, transform: object, state: object }>, clockMs: number, frozenWhileFootage: boolean }
```
`Layer` = an L1 primitive `{ type, params, startCue, endCue, z }`. Each L2 block ships a JSON-schema for `params` and a golden test.

**Post-Gate (additive only, names indicative):**
- Prisma tables:
  - `MgdProject` (workspace, source project/clip, mode `enhance|doc`, status);
  - `MgdMoment` (the table above, plus licence/source per asset);
  - `MgdStyleSpec` (one per video: house + world JSON, rationale, distance results). Plus a per-workspace `MgdHouseStyle` (user-editable constants, optional series lock) and a world history used by the recent-output check;
  - `MgdWorldState` (saved exit/entry states for RETURN);
  - for M2, `DocBeat` (capability `insert|overlay|return`, `footage_mode` + reason, `world_state_ref`, time, narration, visual type `footage|photo_hold|cinematic|diagram|interview|none`, hero asset, on-screen text, reason, source/licence, engine params, duration, transition).
- Worker job types: `MGD_RENDER_MOMENT`, `MGD_QA`, `DOC_ASSEMBLE`.
- The final composite reuses or extends `RENDER_CLIP` (decided after Phase 0), with an additive `ClipEditsV2.directorMoments` lane so the editor and the B0.5 `motionPlan` coexist.
- API, UI and credits are specified after the Gate.

*End of draft. Spec only: no commit, push, issue, PR or comment from Product.*
