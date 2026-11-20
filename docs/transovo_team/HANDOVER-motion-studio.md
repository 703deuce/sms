# HANDOVER: Motion Studio (Transovo AI). Read this first.

Written: Sun Nov 15 2026, ~2:50 AM ET, by the Chief of Staff bot (automatic handover at 98.1% weekly usage; usage resets Tue Nov 17 3:41 PM ET).
Audience: a brand-new agent who knows nothing. No secret values appear here, only where they live.

---
## 1. What this is
**Transovo AI** is John Jones's AI video clipping and editing SaaS. **Motion Studio** (John's name for it; it was earlier called "AI Studio" / "Transovo Studio") is Transovo's v1 **documentary product**:
users give an idea or script and upload photos and clips. Transovo then:
1. researches the story (**Gemini grounded search** whenever new internet info is needed),
2. writes a sourced narration script,
3. voices it with **ElevenLabs** (with-timestamps → word timings),
4. a **Director** reads the story and picks the scenes, the *world* (e.g. a map for Keef because the story moved place to place; a stock ticker for GameStop because it was about a price), the style, and which words get emphasis,
5. builds motion graphics on **Cinematic Skill** (the Python motion engine; see §4),
6. hands off into real footage (camera pushes into the clip, plays it, pulls back out = "RETURN"; this is John's default),
7. generates a **beat-keyed procedural music score** fresh for each video (tempo, key, instruments and mood come from the story, timed and ducked to narration beats). Users can upload their own music (cut and ducked instead). An **optional ElevenLabs music** tier is an extra choice, not the default,
8. runs automated QA checks and fix loops, then renders the MP4.
The agent also inspects user uploads (looks, listens, transcribes) the same way the existing clipper agent does.

### Two-part architecture (John's decision)
- **Part 1, shared core:** blocks every video uses (word clock, script model, world canvas, camera, finish, audio, handoff, charts, maps, text…).
- **Part 2, custom per-video code:** fresh worlds and scene code generated for each customer so videos don't look alike. There are **no reusable world templates**.
- **Models:** both parts run on **GPT-6 Luna** for now. If the custom step falls short, switch **only that step** to **GPT-6.1 Sol** (not Sol 5.6). Batch mode can halve prices for work that doesn't need to run live. The Sol vs Luna bake-off was cancelled.
- **Reuse rule:** reuse existing Transovo systems (editor, uploads, transcription, credits, auth, workers). The main timeline screen adapts the existing **Compact Editor**. Write only the new engine, director and screens.

### John's standing rules for this product
- Don't flag copyright or licensing of customer uploads, music or market data (e.g. Yahoo Finance charts). That's the user's responsibility, not a blocker.
- Never show $ in the UI; show credits only.
- **Build phase (current):** only **New (Backend)** and **Frontend Engineer** build Motion Studio. There are **no QA/VQ/Security handoffs** during the build, to save credits. Push to master early, fix from build and worker logs, avoid long local self-testing, and test by logging into the live app's front end. Build it front to back without asking John.
- The general team rules are in `/workspace/transovo_team/TEAM.md`: never touch the SMS worker or Coolify app3; no force-push; additive migrations only; no secrets; no automatic paid retries; don't break existing modes (upload/stream clipping, editor, Story, multi-source Story, Clean Take).

---
## 2. Where everything is
### Specs (in /workspace/transovo_team/)
| File | What |
|---|---|
| specs/transovo-studio-build.md | Binding build spec (ST-* requirement IDs, traceability table, John's decisions at the top) |
| specs/studio-reference-workflow.md | **What was actually done** for Keef and GameStop, stages S1–S16, the handoff, core vs per-video, and a gap table. Its key sections are copied in §3 below |
| specs/motion-studio-vision.md | Product vision |
| specs/documentary-studio-ux-concept.md | John's full UX/workflow concept (binding) |
| specs/documentary-director.md | Director design + QA gates A1–A17 |
| backend/motion-studio-api-contract.md | `/api/motion-studio/*` API contract |
| drafts/filing/filed.json (+issues.json, file_issues.py) | Map of spec IDs → GitHub issues #1198–#1259 |
| TEAM.md, roles/*.md, runbooks/ (logs.md, ci-gates.md) | Team rules, charters, runbooks |

### Prototype projects (on the box)
- `/workspace/code_motion_cinematic/keef`: Round 1 Chief Keef film on Cinematic Skill (39.8 s).
- `/workspace/round2_shared`: GameStop narration.txt, facts.md, vo.mp3, vo_words.json.
- `/workspace/round2_cinematic/gme/`: the GameStop project on Cinematic Skill: `scene.py` (scenes), `ext.py` (custom blocks / engine extensions), `music.py` (procedural beat-keyed score), `audit.py` (automated checks), `measure_mix.py` (loudness / mix measurement), script.json, sfx_cues.json, photos.json, assets/, audio/, fonts/, out/.
- `/workspace/keef_insert_test` (assemble.py, render_transitions.py) and `/workspace/gme_insert_test` (build.py, NOTES.md): footage handoff tests, hardcut.mp4 vs return.mp4, plus credits.txt.
- Other engines tried (not chosen): `code_motion_test`, `round2_custom` (custom skia); `code_motion_parallax`, `round2_parallax` (HyperFrames + GSAP).

### Repo: https://github.com/703deuce/sms (GitHub is the source of truth)
- Web app: `new-app/`. Motion Studio UI: `new-app/app/app/motion-studio/` (page.tsx, new/, [projectId]/) and `new-app/components/motion-studio/`.
- Workers: `worker/`. Motion Studio worker: `worker/clips_worker/motion_studio/` (on master: `__init__.py, check_setup.py, core/, directors/, pipeline/, sandbox/, vendor/`). Cinematic Skill is vendored under `vendor/`.
- GitHub access: env `GITHUB_TOKEN` from /home/box/.transovo_team_secrets.env (use `GH_TOKEN=$GITHUB_TOKEN gh …`; never print it).

### Local checkouts / worktrees on the box (main repo: /workspace/sms on master)
- `/workspace/sms-studio` → branch **feat/motion-studio-fe-asks** @ d3a707f3d. The working tree was clean at handover, and that branch is already merged (PR #1267). Start new work from fresh master on a new branch.
- `/workspace/sms-t2v-reimagine` → branch `devops/motion-render-worker` (DevOps render-worker work; check its status before use).
- Unrelated worktrees: sms-captions, sms-deadlock, sms-logfix, sms-precision, sms-t2v, sms-unified-fix, sms-yt, f1-logs, deploy-*, pr1193, sms-master-ro.

### Server
- Hetzner + Coolify. SSH: `cursor-agent@128.140.102.51` with the key at /home/box/.ssh/grokbot_hetzner_ed25519. App secrets live in the Coolify app env; never copy them.
- **Web app** deploys automatically on merge to master. Verify with `/api/health` → commitSha.
- **Workers** deploy with `scripts/deploy-worker.sh` (only Backend or DevOps run it). Production logs: `runbooks/logs.md`.
- **Never** deploy or modify the SMS worker or Coolify app3.

---
## 3. GitHub status (read live at handover)
### Merged PRs (Motion Studio)
- #1260 Frontend FE-1…FE-12 (create → setup → workspace)
- #1261 Example project card + posters
- #1262 **Backend + render engine core** (feat/motion-studio-core: core, director pipeline, vendored engine)
- #1263 Session-cookie auth on the live client
- #1264 Require sign-in on /api/motion-studio/*
- #1265 Live by default, credits "Included", cancel
- #1266 Gaps batch 1: TTS format fallback, RE-1 check_setup + OFL fonts, frame-exact seams ≥45 dB, G2 faces
- #1267 FE #1265 asks (settings.music echoed incl. none, provider-neutral labels)

### Issues
#1198–#1259 were filed from the spec (map in drafts/filing/filed.json). **All are still OPEN except #1242 (FE-12, closed)**, even though much of the code has landed in the PRs above. The issues were not closed as the work merged, so check the code, not the issue state.
- RE-1…RE-12 = #1198–#1209 (render engine: vendoring, render service + segment cache, engine boundary, three-layer composition, blocks, Media Handoff, sandbox runner, foundation blocks, fix loop, audio + music bed, Part-2 generator, score generator)
- BE-1…BE-22 = #1210–#1230 (data model, routes/state machine, Story agent, Media Researcher, Director, footage adapter, upload understanding, narration, timeline/mix, Director chat, credits estimator, activity events, handoff records, export integrity, data adapters, narration rules, quote location, brief standard, found-clip transcription, Luna/Sol routing, ElevenLabs music tier)
- FE-1…FE-12 = #1231–#1242
- DO-1/2 = #1243–#1244; QA-1…7 = #1245–#1251; VQ-1…3 = #1252–#1254; SEC-1…5 = #1255–#1259 (QA/VQ/SEC are **parked** during the build phase per John)

---
## 4. The motion engine: Cinematic Skill
- Source: **github.com/Moh4696/cinematic-skill**, pinned at commit **bf43556**, MIT licence. Python + **skia-python** (2D drawing) + **ffmpeg** (encode and mux).
- Vendored in the repo at `worker/clips_worker/motion_studio/vendor/` (the pin + check_setup.py came in PR #1262 / #1266).
- **How a film is written:** a project folder holds a `script.json` (lines with `text` for display, `spoken` for TTS, `hero`, `typed`), narration audio + word timings, and a `scene.py` that composes scenes from the engine's built-in blocks (text, camera moves, photo treatments, transitions…) plus project-specific blocks in an `ext.py` (e.g. the GameStop ticker / chart world). The engine's `make_beats.py` turns line timings into a beat table (and lints phrases that are typed on screen *and* spoken word for word). `build_narration.py` trims and spaces the lines.
- **How rendering works:** each frame is drawn with skia from a time → state function (the camera, layers and per-word emphasis keyed to the word clock), and the frames are piped to ffmpeg. Renders run in parallel by splitting the timeline into segments and concatenating them. A single segment can be re-rendered on its own (the basis of `MGD_RENDER_SEGMENT` / the segment cache, RE-2).
- Engine-structure tree as vendored in the worktree (generated):
```
.
./__init__.py
./check_setup.py
./core
./core/__init__.py
./core/api.py
./core/audio.py
./core/blocks.py
./core/credits.py
./core/fallback.py
./core/fonts.py
./core/handoff.py
./core/qa.py
./core/render.py
./core/wordclock.py
./core/world.py
./directors
./directors/__init__.py
./directors/documentary
./directors/documentary/__init__.py
./directors/documentary/agent.py
./directors/documentary/brief.py
./directors/documentary/designer.py
./directors/documentary/director.py
./directors/documentary/research.py
./directors/documentary/story.py
./directors/registry.py
./pipeline
./pipeline/__init__.py
./pipeline/analyze.py
./pipeline/config.py
./pipeline/db.py
./pipeline/faces.py
./pipeline/jobs.py
./pipeline/llm.py
./pipeline/music_source.py
./pipeline/narration.py
./pipeline/timeline.py
./pipeline/tts.py
./sandbox
./sandbox/__init__.py
./sandbox/policy.py
./sandbox/runner.py
./vendor
./vendor/__init__.py
./vendor/cinematic_skill
./vendor/cinematic_skill/LICENSE
./vendor/cinematic_skill/VENDORED.md
./vendor/cinematic_skill/__init__.py
./vendor/cinematic_skill/build_sfx.py
./vendor/cinematic_skill/engine.py
./vendor/cinematic_skill/make_beats.py
./vendor/cinematic_skill/mix_soundtrack.py
./vendor/cinematic_skill/render.py
```

---
## 5. Bot roster and ownership (agent ids for SendToAgent are in TEAM.md)
- **Chief of Staff** (d7a6dc1a-…): orchestration, backlog, reports to John.
- **New, Backend Engineer** (8508ade4-…): **actively building** the Motion Studio worker/engine/API.
- **Frontend Engineer** (610ea706-…): **actively building** the Motion Studio UI.
- On standby during the build phase: Researcher, Product Manager (wrote the specs), QA, Video Quality, Security, DevOps (render-worker branch), Landing Pages, Customer Support, Growth & Analytics.

## 6. Done vs left vs next
**Done:** engine chosen (Cinematic Skill), reference films (Keef, GameStop, insert tests), full specs, 62 issues filed, frontend shell merged and live behind sign-in, backend core + vendored engine merged, gaps batch 1 merged.
**Left (per the open issues; verify against the code):** end-to-end idea→MP4 on the live app; the Part-2 per-video world/scene generator (RE-11) and sandbox (RE-7); the per-video score generator (RE-12); Media Handoff in production (RE-6/BE-13); the Director (BE-5) and Story/Research agents (BE-3/4, Gemini grounded search); timeline adapting the Compact Editor (FE-6/BE-9); Director chat (BE-10/FE-7); credits estimator (BE-11); render pool capacity (DO-1); the optional ElevenLabs music tier (BE-22); Luna/Sol routing (BE-20). Close the issues as items land.
**Blockers:** weekly usage at 98% (resets Tue Nov 17 3:41 PM ET). Bots were told to stop starting new work until then.
**Next steps after reset:** (1) log into the live app → Motion Studio → run one idea→MP4 and read the worker logs; (2) fix what breaks; (3) finish RE-11/RE-12/RE-6 so output matches the reference films; (4) reconcile issue states with merged code.

---
## 7. DETAILED PIPELINE: how the Keef and GameStop films were actually made
The text below is copied verbatim from `specs/studio-reference-workflow.md` (§1–§6), the evidence-based record. Key facts in short:
- ElevenLabs voice "Brian" (public voice id nPczCjzI2devNBz1zQrb), `eleven_multilingual_v2`, stability 0.55, similarity 0.75, style 0.15, speaker_boost on, **speed 0.85**, `<break time="0.6s"/>` between sentences, mp3 128 kbps. The **with-timestamps** endpoint gives character timings → words → `vo_words.json`.
- The beat table comes from the word timings. A world is chosen per story. Scene code = built-in blocks + custom `ext.py`. Preview stills / contact sheets come before the full render. `audit.py` runs the automated checks. Fix loop → `music.py` (procedural beat-keyed score) → mix measured with `measure_mix.py` (loudness) → parallel render → small export written to a temp file then renamed → credits.txt.
- Handoff: find the narration point from word timings; the hard cut needs no engine render; RETURN re-renders only the move segments using the clip's exact first and last frames. Known bugs and fixes are in §3.5 below.

## 1. What was produced tonight (inventory)

| Round | Topic | Engine | Folder | Output (ffprobe) | Wall clock (file mtimes, ET) |
|---|---|---|---|---|---|
| R1-A | Chief Keef / drill | Custom Python + skia | `code_motion_test` | 1920×1080, 1184 fr, 39.48 s | 19:56 → 20:34 (~38 min) |
| R1-B | Chief Keef / drill | Cinematic Skill (`Moh4696/cinematic-skill` @ bf43556) | `code_motion_cinematic/keef` | 1920×1080, 1193 fr, 39.79 s | 20:05 (repo) → 20:38 (~33 min) |
| R1-C | Chief Keef / drill | Parallax Doc (HyperFrames + GSAP) | `code_motion_parallax` | 1920×1080, 1170 fr, 39.00 s | 20:05 → 20:50 (~45 min, 3 renders v1–v3) |
| R2 shared | GameStop narration, facts, word timings | ElevenLabs | `round2_shared` | vo.mp3 48.74 s | 22:34 → 22:35 (`READY` flag) |
| R2-A | GameStop | Custom Python + skia | `round2_custom` | 1542 fr, 51.42 s | 22:34 → 22:53 (~19 min) |
| R2-B | GameStop | Cinematic Skill + `gme/ext.py` | `round2_cinematic` | 1581 fr, 52.70 s | 22:35 → 23:12 (~37 min) |
| R2-C | GameStop | Parallax Doc / HyperFrames | `round2_parallax` | 1500 fr, 50.00 s | 22:34 → 23:12 (~38 min) |
| Insert-K | Keef + "I Don't Like" video | Cinematic Skill (R1-B film reused) | `keef_insert_test` | hardcut 1463 fr 48.81 s; return 1519 fr 50.65 s | 23:19 → 23:40 (~21 min) |
| Insert-G | GameStop + CNBC Gill clip | Cinematic Skill (R2-B film reused) | `gme_insert_test` | hardcut 1869 fr 62.31 s; return 1882 fr 62.74 s | 23:21 → 23:44 (~23 min) |

The per-folder start times are the first non-library file. The dispatch time of each executor is **unknown**: it isn't in any file.

Decisions along the way (from memory and the VQ files):
- After R1, VQ scored A 26/35, B 23/35, C 23/35.
- After R2 (memory, 11:18 PM ET), John picked **Cinematic Skill** as the base engine ("some custom touches look cool").
- After the insert tests, John chose RETURN (camera into and out of the footage) as the default.

---

## 2. End-to-end pipeline as performed (stages S1–S16)

Each stage gives: what was done, the concrete tool or parameter, the file evidence, and where the rounds differed.

### S1. Topic → story angle
- **R1:** "Chief Keef / how drill took over". The angle is a 12-line, ~37–40 s arc: house arrest → video → Kanye remix → Interscope $6M → Love Sosa → "Drill" → global spread → back to the grandma's-house video.
- **R2:** "GameStop short squeeze, Jan 2021". The arc runs from the 140% short interest → WallStreetBets / Roaring Kitty → $17 → $483 → Melvin rescue → Robinhood buy button off → hearing → "I like the stock." It is built around the closing quote.
- **Who:** the orchestrating agent (Chief of Staff) chose the topic and angle. In R1 each executor wrote its own script. In R2 one shared script was written centrally (S3).

### S2. Fact research → `facts.md` with sources
- **R2 (centralised):** `round2_shared/facts.md` is a table with three columns: **narration line**, **verified fact**, **source**. Sources: Wikipedia "GameStop short squeeze" and "Melvin Capital", NYT Jan 29 2021, WSJ Jan 25/31 2021, Business Insider, The Hill, CNBC and Reuters Feb 18 2021.
- It also holds "other verified details for visuals", such as the red gaming chair, the "Hang in there!" kitten poster, the $53k → ~$48M stake and Musk's "Gamestonk!!".
- It records a **data caveat**: prices are pre-2022-split, and $483 equals $120.75 split-adjusted.
- **R1 (per executor):** facts went straight into each `credits.txt` "FACT SOURCES" block: Wikipedia "Chief Keef", Gawker Mar 12 2012, Billboard May 1 2012, Guardian/DNAinfo for the $6M deal, Complex 2022. Executors fetched the Wikipedia pages (cached page dumps are in the bot's assets).
- **Rules visible in the outputs:**
  - Every number on screen has a source line.
  - Illustrative values are marked as such. For example, the R2-B credits say the Reddit upvote counter "88.4k" is illustrative, and R2-A says its 2016–2020 sparkline is illustrative.
  - Hedged wording is kept from the source ("a **reported** six-million-dollar deal").

### S3. Narration writing
- **Text (R2):** `round2_shared/narration.txt` has 89 words in 13 sentences.
- **Rules observed in the text [inferred from the artifacts]:**
  - Short declarative sentences, one story beat each.
  - Ellipses ("...") for dramatic suspensions before payoffs ("tells them... I like the stock").
  - **Numbers written as spoken** ("four hundred and eighty-three", "two-point-seven-five-billion-dollar", "January twenty-eighth").
  - Fragments for rhythm ("They buy. And they hold.").
- **R1 Cinematic `script.json`** keeps two fields per line, `text` (display) and `spoken` (TTS form, e.g. "2011" → "Twenty eleven"), plus `hero` and `typed`.
  - The engine's `make_beats.py` **lints** any phrase that is both typed on screen and spoken word for word. It flagged line 9 "DARK. SLOW. RAW." in `keef/beats.md`.
- **Pacing rule:** the R1 VQ measured 134–141 wpm overall, and John said the read felt rushed. VQ recommended "~120–125 wpm with longer pauses at section breaks" (`keef-engine-comparison.md`). R2 applied this with speed 0.85 and 0.6 s breaks (S4).

### S4. Voiceover (TTS with word timings)
| | R1-A custom | R1-B Cinematic | R1-C Parallax | R2 shared (all three engines) |
|---|---|---|---|---|
| Engine | ElevenLabs (final); first draft edge-tts `en-US-ChristopherNeural` | edge-tts `en-US-AndrewNeural`, rate −8% | edge-tts `en-US-AndrewNeural`, rate −6% | **ElevenLabs** |
| Voice / model | "Brian – Deep, Resonant and Comforting" (`nPczCjzI2devNBz1zQrb`), `eleven_multilingual_v2`, 489 chars | – | – | Brian, `eleven_multilingual_v2`, `voice_settings`: stability 0.55, similarity_boost 0.75, style 0.15, speaker_boost true, **speed 0.85** (`round2_custom/el_req.json`) |
| Pauses | `tighten.py`: silences > 0.6 s shortened to 0.5 s; 0.5 s lead, 1.6 s tail | engine `build_narration.py` (trims each line, sets gaps, optional tempo) | `pace.py`: inserted 0.25–0.45 s pauses after chosen words; loudnorm −18 LUFS | **`<break time="0.6s" />` between every sentence** in the request text |
| Word timings | `vo_el_words.json` | edge-tts `WordBoundary` events → `word_times.py` maps them onto the engine timeline (letter-count alignment per line, corrected for −50 dB leading-silence trim and tempo) | `WordBoundary` → `words.json` shifted by the inserted pauses | ElevenLabs **with-timestamps** endpoint: character timings → **words**, with break tags removed → `vo_words.json` ({word,start,end}, 89 words, 48.74 s) [endpoint name parent-reported; char→word build stated in facts.md] |
| Format | mp3 128 kbps | wav 48 k | m4a 192 k | **mp3 128 kbps** (`ffprobe`: 128000 b/s, 44.1 kHz mono). **[parent-reported]** the 192 kbps output format returned HTTP 403, so it fell back to 128 kbps. |

- **Verification:** VQ ran faster-whisper `small.en` on the R1 final mixes. Median offset vs the JSON timings was −47 / +32 / +25 ms (A/B/C), so the timings are trustworthy.
- **Sharing:** R2 used **one shared VO** for all three engines (fair comparison, one paid TTS call). A `READY` sentinel file was written at 22:35 so the executors could start.

### S5. Beat table from word timings
- **Cinematic:** the engine's `make_beats.py` builds `beats.md` with these columns: #, start, length, narration, hero on screen, typed text, plus a lint section.
  - The first table is **estimated from letter counts** before any voice exists. It is replaced by real word timings once the VO lands.
- **Custom R1:** `beat_table.md`. **Parallax:** `SCRIPT.md` + `shots.json`.
- **Scene code anchors to words, not seconds:**
  - Keef: `W(line, "word")` via `real_word_times()` (falls back to the letter-share estimate).
  - GME: `words_W()` **raises** if a word is missing, instead of guessing.
  - Custom: `T("word", n)`. Parallax: `T(word, n)` over `vo_words.json`.
- **Hero rule:** one hero per beat. The engine's `focus` spotlight dims everything outside a radius.

### S6. Per-video style / world choice
- **Keef → "one dark-teal world map"** (`keef/scene.py` docstring). The story is geographic: South Side → Kanye/Interscope (US) → "Drill" over the Atlantic → London/Brooklyn spread. The anchor motif is a **glowing red pin + red pen circles** on B&W prints.
- **GME → "trading terminal"** (`gme/scene.py`): "The world is one giant GME candlestick chart (real daily OHLC, pre-split) on a dark trading-terminal grid. The camera travels the timeline left to right and climbs the spike; story beats arrive as glass app windows."
  - Why: the story **is** a price chart, so the chart doubles as the timeline and the spatial world, and app windows (Reddit, Robinhood, YouTube, a news terminal, the hearing feed) carry the human beats.
  - The research basis is `research/motion-graphics-style-variety.md`: one anchor motif per film, chosen from the whole script, not keyword → style.
- R2-A custom and R2-C Parallax independently chose a **chart world** for GME too (`round2_parallax/build/gen.py`: stations around a log-scale candle chart; R2-A: phone UI, Reddit card, hearing tiles). That is three engines and the same world choice, which supports "the data is the world" as a director heuristic **[inferred]**.

### S7. Asset sourcing
**Photos**
- **Wikimedia Commons**, via Cinematic Skill `fetch_commons.py`. It reads the file page API (`imageinfo`, `extmetadata`, `iiurlwidth=3200`) and fills file, source, credit, licence, licence_url, date and `license_ok` (regex for free licences; otherwise "CHECK").
  - Examples: GameStop Vallejo (CC BY 2.0), Capitol at Dusk (CC BY-SA 3.0), Kanye 2011 (CC BY 2.0), Parkway Gardens (CC BY-SA 3.0).
- **YouTube thumbnails** (`maxresdefault.jpg`) for video stills: the Love Sosa and I Don't Like videos, the Roaring Kitty channel, and the hearing via Global News. Logged as copyrighted, internal only.
- **Press / cover art:** The FADER (R1-A), the Finally Rich cover from Apple Music 1500 px, the Love Sosa cover from Wikipedia (316 px), and the AP hearing photo via courthousenews (R2-A). All logged as copyrighted, internal only.
- **Manifest per film:** `photos.json`, with `{id, what, kind, file|commons, crop[x0,y0,x1,y1], source, credit, license, license_url, date, license_ok}` and a film-wide `grade` ("bw" for Keef, "natural" for GME). The engine's `prep_assets.py` writes `prep/photos/meta.json` with pixel sizes.

**Resolution rules (as practised and learned)**
- R2-C Parallax: "3840 px sources downsampled to 2000 px; **never upscaled**" (credits) and the `3840px` Commons thumbnail URL in `photos/sources.txt`.
- The R1 Keef assets were small (`meta.json`: P05 316×316, P03 646×768, P01 768×720, P02 1280×720). VQ flagged the soft enlarged thumbnail in R1-C (5.2–11.5 s).
- The insert tests added the "720p source looks soft" learning (A16 in the director spec).
- R2 GME assets were larger (STORE 3200×2016, CAPITOL 2919×1927), but GILL was 640×720 (a crop of a thumbnail).

**Code-drawn UI instead of screenshots**
- The Reddit post card, Robinhood-style buy window, headline cards, phone UI and hearing tiles were redrawn in code (no logos).
- R1-A's YouTube-style red play button was flagged by VQ as a "no logos" violation.

**Real data**
- R2-B and R2-C: **Yahoo Finance chart API**, GME daily OHLC Dec 28 2020 – Feb 12 2021 (`round2_cinematic/raw/yahoo.json`, `round2_parallax/build/yahoo_gme.json`).
  - **Multiplied by 4 to undo the 2022 4-for-1 split** (`raw/gme_ohlc_presplit.json` → `gme/assets/gme_ohlc.json`), so it matches the narration ($17.25 Jan 4 close, $483.00 Jan 28 intraday high).
- R2-A used a **reconstructed / approximate** OHLC with sourced key values, and logged it as such.
- **Keef:** map geodata `world-atlas@2 countries-50m` (Natural Earth, public domain) via `map.json`: mercator lon0 −40, clip box, and named places with lat/lon.

**Clips (insert tests)**
- **yt-dlp** (`/home/box/.local/bin/yt-dlp`).
- **Keef:**
  - Source: the official "I Don't Like" upload (1280×720, 29.97 fps, 309 s).
  - **In point 65.699 s = "the exact frame that matches the P02 YouTube thumbnail"** already used as the print in the film. Out point 74.699 s.
  - **9.000 s = 20 beats at ~133.3 BPM** (musical phrase).
  - Avoids the burned-in lower-third that is only on screen in the first ~15 s.
- **GME:**
  - Source: the CNBC Television upload of Gill's opening statement (1920×1080, 29.97 fps, 324 s) **plus its English auto-captions** (`cnbc_gill_testimony.en.vtt`).
  - The captions were used to **locate the quoted line** at 5:00.32–5:08.80. Excerpt 5:00.15–5:09.80 = 9.63 s / 289 frames.
- Both were conformed to 1920×1080 @ 30 fps CFR (`work/clip.mp4`, `src/insert_full.mp4`).

### S8. Scene composition code on the engine
- **Framework (Cinematic Skill, unchanged repo code):**
  - Pipeline: `new_project.py` scaffold.
  - Rendering: `engine.py` Film / Doc / Item / Renderer on skia, 4K world coordinates; camera keys `cam(t,x,y,zoom,rot)` and `shot(...)` (cam + focus); spotlight `focus(t,x,y,radius,strength)`; handheld wobble; finish (glow, vignette, grain, grade curve) from a `LOOK` dict.
  - Components: Print, FilmFrame, PenMark, Stamp, StringLine, BigText, Counter, GeoMap, Route, DotField, MapPin, PaperDoc, Card, Ledger.
  - Sound: auto SFX cues from items (`cues()`), `build_sfx.py` (15 synthesised sounds: whoosh, pop, slide, marker, pencil, tick, snip, click, stamp, impact, boom, ticks, shimmer, drop, riser), `mix_soundtrack.py`.
  - Assets and output: `fetch_commons.py` / `prep_assets.py`, `render.py` (parallel chunks).
- **Custom per film:**
  - **Keef** (`keef/scene.py`, 199 lines): `GlowPin` (pulsing red pin + typed mono label), `SlamText` (BigText with 3× faster fade-in to land on the beat), `real_word_times()`. Everything else is engine components.
  - **GME** (`gme/ext.py`, 661 lines + `scene.py` ~170 + `music.py` + `audit.py` + `measure_mix.py`). NOTES estimate "framework ~55% of what runs, custom ~45%; essentially all on-screen design is custom".
    - Camera and finish: `OrganicFilm` (Catmull-Rom camera + drift/breathing), `per_frame_grain`.
    - Text safety: `legible` / `text` (40 px gate + edge fade + audit hook).
    - Components: `CandleChart`, `PriceTag`, `Panel` (glass window), `Hero`, `Roll`, `Particles`, `ShortArrow`, `Flash`, `GemHold`, `Ambient`, and the content painters `reddit_content` / `buy_content` / `headline_content`.
- **R2-A custom** (`render2.py`, 34 KB): every primitive written from scratch (easing, fonts with variable axes, `T(word)`).
- **R2-C Parallax** (`gen.py`, 30 KB): generates HTML/GSAP "stations" on one world plane plus a candle chart; HyperFrames renders headless Chrome frame by frame.

### S9. Preview stills, contact sheets, motion strips
- Stills at chosen times (`round2_cinematic/stills/t002.2.jpg` … 18 stills).
- Contact sheet via `code_motion_cinematic/sheet.py`: PIL grid of 640×360 tiles with filename labels.
- **Motion strips** around key moments (`strip_27.5-30.5_483.jpg`, `strip_46.5-49.5_ending.jpg`).
- The insert tests saved **seam stills**: Keef `base_13.6…15.2`, `push_000/018/035`, `pull_*`, `seam_hardcut_after_in_14.733.png`; GME `hardcut_before/clip_in/clip_out/after`, `return_hold_end/push_mid/dissolve_in/clip_mid/pull_start/pull_mid/settle`.
- GME probe stills were used to **choose the tight camera pose** (`probe_tight_z080…z148`, `probe_hold_t46.00/47.10`).
- VQ used 1 fps grids plus 0.1 s strips from −400 to +800 ms around each hit word, phone-size 480 px frames and native 1080p crops.

### S10. Automated audits (as run)
| Audit | How it was done | Threshold used | Evidence |
|---|---|---|---|
| Text size | `gme/ext.py legible()`: cap height = size × font cap ratio × camera zoom; text **fades out rather than render below 40 px** cap height at 1080p. `audit.py` renders held frames at listed times (105 sample times) with `GME_AUDIT=1` and prints every string flagged SMALL or CUT | ≥ 40 px cap at 1080p | R2-B NOTES |
| Edge clipping | `edge_alpha()`: text fades over 30 px as its rect reaches the frame edge; the audit reports "CUT" | inside frame, 30 px ramp | fix for R1-B "LONDON clipped" |
| Black / brightness scan | ffmpeg `signalstats` YAVG per frame (`round2_parallax/yavg.txt`); VQ used `blackdetect` / `freezedetect` (n=0.001, d=0.5) | no unintended black or frozen frames | yavg.txt, measurements.md |
| Duplicate frame / stutter | per-frame diff; R1-B DRILL fade showed diffs alternating 0 / 2.4 (15 fps stutter) → R2 `per_frame_grain()` fix; R2-B "1581 frames @30fps, 0 duplicate consecutive frames" | 0 duplicate consecutive frames | measurements.md, NOTES |
| Frame timing | frame-timestamp delta = 33.333 ms on every frame (CFR) | CFR 30 | measurements.md |
| Loudness | ebur128 integrated + true peak; engine two-pass `loudnorm` | R1 VQ asked for −16 to −14 LUFS; R2-B −15.0 LUFS / −1.5 dBTP; R2-C −15.2 / −1.5; inserts −15 target (Keef TP −1.0, GME TP −1.5) | NOTES, credits |
| SFX vs VO | `gme/measure_mix.py`: EBU momentary (400 ms) of each SFX cue window (0.6 s) vs the voice speech median (M > −35); prints dB over speech and the worst case | R1 VQ: stamps at +1.5 to +7.3 dB over voice were masking words; fix = ~−6 dB or move ~150 ms off the stressed word | measure_mix.py, comparison.md |
| Word sync | visual onset minus word onset from strips | VQ: A 0 to +200 ms best; C typed text late +300–800 ms | measurements.md |
| Voice pace | words/min overall and articulation wpm (VO stem `silencedetect` −40 dB / 120 ms), pause count / mean | target ~120–125 wpm | measurements.md |
| Word timing truth | faster-whisper `small.en` on the final mix vs JSON timings | median within ±50 ms | measurements.md |
| Watch review | a video-analysis model watched each film once; **"Where the watch model and the frames/measurements disagreed, the frames and measurements decide"**. The model invented SFX for C and called late hits "exact". | measurements override | comparison.md |

### S11. Fix loop
- **R1-A custom:** `draft1.mp4` at 20:11 → review → `sfx.py` (20:13) → VO swapped to ElevenLabs Brian (20:25) → re-render in 4 parallel segments (`seg/f0–f3`) → `final.mp4` at 20:32.
- **R1-C Parallax:** three full renders (`render_v1/v2/v3.log` at 20:36, 20:43, 20:50); `build_scenes.py` edited at 20:44 between v2 and v3.
- **R2-B Cinematic:** `audit.py` / `measure_mix.py` written at 22:44–22:48 (before the final render); `ext.py`, `scene.py` and `sfx_cues.json` last edited at 23:03; final render 23:05–23:11 **[inferred from the 334 s render time]**.
- **Insert tests:** the parent reported three bugs found and fixed in the loop (§3.5).
- **Round-level loop (R1 → R2), from `keef-engine-comparison.md` "Top 3 fixes" to what R2 did:**
  1. Thuds masking words, mix too quiet → `measure_mix.py` SFX-vs-speech check; mixes at −15 LUFS.
  2. Labels under 40 px → `legible()` 40 px gate + `audit.py`.
  3. LONDON clipped by the frame edge → `edge_alpha()` edge fade.
  4. DRILL 15 fps stutter → `per_frame_grain()`.
  5. $6M counter still showing odd values after the word → `Roll` duration set to end at the spoken word (`dur = W(4,"percent") − W(4,"hundred") + 0.25`).
  6. Read felt rushed → speed 0.85 + 0.6 s breaks.
  7. Engines were not comparable (different voices) → one shared VO.
  8. "No 2012 on screen" (spoken year missing) → GME puts every spoken date and number on screen (JANUARY 2021, JAN 28, $17, $483, 140%, $2.75B).

### S12. Music and SFX
- **SFX:** always synthesised, no samples.
  - Cinematic: auto cues from items, plus hand-placed `riser` (peaks at t + dur) before big moments, `boom` on the payoff and `stamp` / `drop` on the crash.
  - Cue counts: Keef 37 (10 whoosh, 9 pop, 5 impact, 4 pencil, …). GME 58 (23 tick, 10 impact, 8 pop, 5 whoosh, 3 riser, …).
- **Music:**
  - Keef R1-B: no music bed (VO + SFX).
  - GME R2-B: `music.py` synthesised score: E-minor drone; 96 bpm hats enter on the Reddit beat; a kick builds into $483; **everything cuts at Robinhood "off"**; a sparse pad carries the hearing and swells into "I like the stock", resolving to an open E5 chord. Keyed to word timings.
  - Parallax: `make_bed.sh` drone.
- **Mix:** engine `mix_soundtrack.py`: music gain → `sidechaincompress` duck under the voice (threshold 0.025, ratio 4, attack 35 ms, release 550 ms, defaults) → two-pass `loudnorm` I = target, TP −1.5, LRA 11.

### S13. Final render
- **Cinematic `render.py`:**
  - Splits frames into chunks over `auto_workers` = cpu−1, capped by RAM. Each worker renders skia frames and pipes them to x264 (crf 16).
  - Chunks are joined losslessly, then the soundtrack is muxed.
  - Keef: 1194 frames on **7 workers in 286 s** (0.6–0.8 fps/worker). GME: 1582 frames on **7 workers in 334 s** (0.7–1.0 fps/worker; user CPU 27 min).
- **Custom:** 4 segment processes (R2-A `seg/f0–f3`, ~4 min each, run in parallel), then concat.
- **Parallax:** HyperFrames two-pass `render.sh` with a finish grade.
- **Frame-count note:**
  - The engine logs say 1194 / 1582 frames rendered. ffprobe of the muxed finals shows 1193 / 1581, so **one frame was lost at the mux in both Cinematic films**.
  - **[inferred]** This is the same `-shortest` one-frame loss the parent reported in the insert tests (§3.5).

### S14. Small export and atomic write
- Every film has a `final_small.mp4` (30–46 MB) next to the master (91–261 MB). **[inferred]** The small copy is sized for chat delivery.
  - GME insert: `X264_SMALL` = 6 Mb/s (max 8 Mb/s), AAC 160 kb/s. Masters: crf 16, AAC 192 kb/s.
- **Atomic writes:**
  - `keef_insert_test/assemble.py` and `render_transitions.py` write `*_tmp.mp4` and then `os.replace()`.
  - `gme_insert_test/build.py` writes `.tmp.mp4` and then `Path.replace()`.
  - A leftover 0-byte `keef_insert_test/work/return_pre_tmp.mp4` shows the temp pattern in use.

### S15. Credits file
Every folder has `credits.txt`:
- Engine and commit.
- Voice (provider, voice, model, settings).
- Every image: what, credit, licence, source URL, crop or grade note.
- Data (provider, range, adjustment).
- Fact sources.
- Fonts with licence (SIL OFL).
- Sound: "synthesised, no samples".
- The insert tests add: clip source, in/out, why this moment, output timecodes, what was re-rendered vs reused, loudness.
- Every file starts with "internal test, not for release".

### S16. Delivery and review
- The small copies were sent to John in chat by the orchestrator.
- VQ reviews were written to `transovo_team/video_quality/`.
- John's verdicts were recorded in memory and in the spec decision logs.

---

## 3. Cinematic Media Handoff (insert / return), exactly as done

### 3.1 Find the narration point (word timings)
- **Keef:**
  - Line 4 "I Don't Like hits YouTube": "YouTube" ends 14.681 s, the line ends 14.718 s.
  - Insert at **frame 442 = 14.733 s**, in the pause before "Kanye hears it" (15.118 s).
  - Constants: `A_FRAMES = 442`, `T_PUSH0 = 441/30` (the last frame of part A), `T_PULL1 = 442/30`.
- **GME:**
  - After "them..." (ends 47.121 s): `FRAME_CUT = 1413` (47.100 s).
  - The return re-render starts at the first frame at or after the "tells" camera key (46.327 s): `FRAME_DIV = 1390`.
  - The film resumes at the typography wide shot: `FRAME_RESUME = 1476` (49.200 s).

### 3.2 Clip selection criteria (as applied)
1. **The moment the narration is built around:** the song named in the line (Keef) or the quoted line itself (GME).
2. **First frame matches the still already in the world.** Keef's in point is the exact frame of the P02 thumbnail. GME pushed into the "hearing feed" Gill window.
3. **Avoid burned-in packaging.** Keef's in point is chosen after the lower-third. The GME CNBC clip could not avoid logos, lower thirds or the split chart, which is why it read as a dissolve rather than the photo coming alive (the director-spec learning).
4. **Clean phrase boundaries:** Keef 20 musical beats; GME the caption-bounded sentence.
5. Length ~9–10 s.

### 3.3 Hard-cut variant (no engine render)
- An ffmpeg `concat` of film[0:442] + clip + film[442:]. The film's audio fades out over 0.12 s, the clip fades in 0.08 s and out 0.12 s at **−8.3 dB** (Keef), then the film resumes.
- GME: graphics cut at 47.13 s, clip 9.63 s, graphics resume at the same film time.

### 3.4 RETURN variant (render only the moves)
- **Keef (`render_transitions.py`):**
  - Loads the film's `scene.py`, **sets `film.fade_in = film.fade_out = 0.0`**, and **freezes the world** at the cut.
  - Renders only the camera from the last film pose to a tight pose on Print P02: **36-frame push (1.20 s)** and **36-frame pull**, `ease_in_out`.
  - Handheld wobble is **damped to 15%** as the camera arrives tight, so the match to the clip is stable, and restored on the pull. Motion blur follows the camera path.
  - In the last 0.40 s of the push, the **print image itself crossfades from the still to the clip's first frame** inside the engine ("the photo comes alive"). The pull starts on the clip's last frame and crossfades back to the still.
  - Assembly (`assemble.py`): `xfade` **8 frames (0.267 s)** clip↔push/pull. The film's audio fades out over 0.15 s at the push; the clip audio (−8.3 dB) fades in over 0.20 s at the dissolve; the film's audio fades back in over 0.25 s at resume; then two-pass `loudnorm` to −15 LUFS / TP −1.0.
  - Result: 72 new engine frames, everything else reused.
- **GME (`build.py` + `work/render_seg.py`):**
  - Re-renders a **0.80 s hold**, a **1.20 s push (36 fr)** into the Gill panel (`TIGHT_POSE` zoom 1.12, chosen from the probe stills), and a **2.10 s pull (63 fr)** out to the "I LIKE THE STOCK" typography ending. 3 workers.
  - `blend` expressions over **12 frames (0.40 s)** at each side of the clip.
  - Audio:
    - The clip measured −24 LUFS, so it was gained **+8 dB** to sit near the VO-in-mix (−16 to −15).
    - The music bed was **ducked an extra −8 dB** with 0.40 s ramps.
    - Audio crossfades of 0.18 s, mixed with `amix normalize=0`.
    - Two-pass loudnorm to −15 LUFS / TP −1.5 (measured −15.27 / −1.50).
  - `timing.json`: build `elapsed_s` 323.6.
- **What was proven:** both tests needed no VO regeneration and no full re-render. The first versions used dissolves, not frame-exact seams.
  - John's follow-up rule (12:0x AM): grab the clip's **first frame** as the surface image for the push and the **last frame** for the pull. That is now ST-TR-003 / ST-CMH-002/004/009, and is **not yet validated in a render**.

### 3.5 Bugs hit (parent-reported, with the code evidence)
| Bug | Cause | Fix / evidence |
|---|---|---|
| **Fade-to-black inside the spliced move** | Rendering a segment through the engine applies the film's default `fade_in` / `fade_out` (engine defaults 0.9 s / 2.2 s; Keef film 0.6 / 1.6) to the segment | `film.fade_in = film.fade_out = 0.0` in `keef_insert_test/render_transitions.py` before rendering segments |
| **ffmpeg `-shortest` drops one frame** | Muxing video with a slightly shorter or rounded audio stream; `-shortest` cuts at the shorter stream | Still present in `gme_insert_test/build.py mux()`. The same one-frame loss shows in both Cinematic finals (1194→1193, 1582→1581). The product needs a frame-count parity check (§7). |
| **Partially written file grabbed early** | A reader (preview / small export / delivery) picked up an mp4 while ffmpeg was still writing it | Write to `*_tmp.mp4` / `.tmp.mp4` and then rename atomically (`os.replace`); a 0-byte `return_pre_tmp.mp4` remains in `keef_insert_test/work/` |

---

## 4. Orchestration layer (how the work was organised)

### 4.1 Roles as they actually ran
| Real role tonight | What it did | Product role |
|---|---|---|
| Orchestrator (Chief of Staff, main chat) | Chose topics; wrote briefs; in R2 wrote narration + facts and generated the shared ElevenLabs VO; dispatched executors in parallel; relayed John's feedback; gated what went to John | Documentary Director + Story agent (+ run supervisor) |
| Render executors (one per engine per round) | Sourced photos, data and fonts; wrote scene code; ran previews, audits and fix loops; rendered; wrote credits | Media Researcher (sourcing), Motion Designer, Mixer, self-QA |
| Insert-test executors (one per film) | Downloaded the clip, chose in/out, rendered only the moves, spliced, mixed and exported | Footage Editor + Motion Designer (handoff) + Mixer |
| Video Quality agent | Watched each film with a video model and measured everything; scored 7 axes; listed top fixes | QA / VQ |
| Product Manager agent | Turned verdicts into specs (`documentary-director.md`, `transovo-studio-build.md`) | (product process, not runtime) |

### 4.2 Brief structure (reconstructed from the artifacts; the actual text is not available here)
The common fields in every executor's outputs show the brief asked for:
1. Topic + angle + target length (~40 s in R1, ~50 s in R2).
2. Engine (repo + commit) and output folder.
3. Script rules: one hero per beat, typed **or** spoken, words-anchored timing.
4. Voice: provider, voice and settings; in R2 "use the shared VO in `/workspace/round2_shared`, wait for READY".
5. Assets: Commons first, licence logging, copyrighted material allowed only as internal test, no logos.
6. Look: one continuous camera / world, "no AI video, no stock footage, code only".
7. QA expectations: R2 added the round-1 VQ fixes (≥ 40 px, edges, −16 to −14 LUFS, SFX not masking words, slower read).
8. Deliverables: `final.mp4`, `final_small.mp4`, `credits.txt`, NOTES (framework vs custom share), report.
9. Hard rules: no paid APIs beyond the one TTS call, never print keys, don't touch the repo / SMS worker / Coolify.

See Appendix A.

### 4.3 Feedback loops that ran
1. **Inside each executor:** preview stills / contact sheet → audit scripts → fix → re-render (S9–S11).
2. **VQ review per engine** (R1): model watch + measurements → scores + top 3 fixes per engine (`keef-engine-comparison.md`).
3. **Round 1 → Round 2:** VQ fixes and John's comments became R2 brief requirements and code (§S11 list). The shared VO removed voice as a variable.
4. **John verdict → spec:** R2 picked the engine; the insert tests picked RETURN as the default; the first/last-frame rule; the PM wrote them in.

---

## 5. Measured timings and costs

| Stage | Measured | Source |
|---|---|---|
| Shared R2 VO + facts + word timings | Produced by 22:34–22:35. Generation time **unknown** | mtimes |
| R1 executor wall clock | A ~38 min, B ~33 min, C ~45 min (from first project file to small export) | mtimes |
| R2 executor wall clock | A ~19 min, B ~37 min, C ~38 min | mtimes |
| Insert tests | Keef ~21 min (23:19 → 23:40), GME ~23 min (23:21 → 23:44); GME build.py run 323.6 s | mtimes, timing.json |
| Cinematic final render | Keef 286 s / 1194 fr / 7 workers; GME 334 s / 1582 fr / 7 workers (≈ 6.3 s of render per 1 s of output at 1080p) | final.log, final_render.log |
| Custom R2 segment render | ~4 min per segment, 4 in parallel | seg/l*.txt |
| Handoff move render | Keef 72 frames; GME 135 frames (hold + push + pull). Exact seconds **unknown** | scripts |
| Paid API cost | **ElevenLabs only.** R1-A: 489 characters. R2: one request of ~586 text characters plus 12 break tags (`el_req.json`). Dollar cost **unknown** (plan tier not recorded). Everything else was free: Commons, Yahoo chart API, edge-tts, yt-dlp, synthesised audio, local CPU | credits, el_req.json |
| LLM / agent tokens | **unknown** (not in any file) | – |
| Compute | One shared box (7 render workers = cpu−1); no GPU used | render logs |

---

## 6. Keef vs GameStop: what stayed the same vs what changed

**Primary diff:** `code_motion_cinematic/keef/scene.py` (Keef, R1-B) vs `round2_cinematic/gme/{scene.py, ext.py, music.py, audit.py, measure_mix.py}` (GME, R2-B), plus `keef_insert_test/{render_transitions.py, assemble.py}` vs `gme_insert_test/{build.py, work/render_seg.py}`.
**Supporting evidence:** the custom (R1-A / R2-A) and Parallax (R1-C / R2-C) versions of the same two topics.

**How the two scene files are built (identical skeleton):**
1. Docstring stating the world.
2. `LOOK` dict with the same 7 keys.
3. A word-time lookup `W(line, word)`.
4. `build_film(doc)`: create a Film, add one world object, then per narration line add hero items timed `W(line, word) ± 0.05–0.3 s`.
5. Camera `shot()` keys timed to words.
6. Riser / boom cues before the big moments.
7. Fade in / out.
8. `return film`.

Only the world, the items and the numbers change.

### 6A. CORE BUILDING BLOCKS (identical or near-identical across both)

| # | Proposed block | What it does | Parameters (as used) | Keef source | GME source | Also in custom / Parallax? |
|---|---|---|---|---|---|---|
| B1 | `narration.tts_with_word_times` | TTS + word timing table | provider, voice, model, speed, stability/similarity/style, `break` seconds between sentences, output format with fallback | edge-tts `edge_take.py` + `word_times.py` | ElevenLabs with-timestamps → `vo_words.json` | Yes (all 6 films) |
| B2 | `timing.word_clock` `W(line, word, nth, end)` | Resolve a spoken word to a time; fail loudly on a miss | line id, word, nth occurrence, start/end | `real_word_times()` (fallback to estimate) | `words_W()` (raises) | Yes: custom `T()`, Parallax `T()` |
| B3 | `script.lines` + `beats.lint` | Per line: `text`, `spoken`, `hero`, `typed`; beat table; lint "typed and spoken" | ids, takes | `script.json`, `make_beats.py` | `script.json` | custom `beat_table.md`, Parallax `SCRIPT.md` |
| B4 | `world.canvas` | One huge world (4K-px world coords) that the camera travels; everything lives in it | world kind (map / chart / board), size, tile | `GeoMap` + `Board` | `CandleChart` + `Board(tile=2400)` | Parallax `ST` stations on one plane; custom single board |
| B5 | `camera.path` | Keys `shot(t, x, y, zoom, rot, radius, strength)`, `cam`, `focus` on word times; ease; handheld wobble | key list; spline type; drift amp; wobble damping | engine `Spline` keys | `OrganicFilm` Catmull-Rom (`CR`, zero velocity only at ends) + drift (26/14 px sines) + zoom breathing 1.2% | Parallax `cameraRig`; custom eased keys |
| B6 | `camera.spotlight` (hero rule) | Dim everything outside a radius on the current hero | radius 3000–26000, strength 0.1–0.5 | `shot(..., radius, strength)` | same | – |
| B7 | `type.hero_slam` | Big display type that lands on the word (fast scale/alpha + impact cue), optional per-word reveal | text, size, font, color, glow, hit gain, per-word times, color per word | `SlamText` (BigText ×3 speed) | `Hero` (spring 1.35→1, `words=[...]`, `colors`) | custom slams; Parallax typed text |
| B8 | `data.rolling_number` | Number counts to a sourced value and **lands on the spoken word** | v0, v1, dur (= word span), fmt, prefix/suffix, caption, ticks + impact cue | engine `Counter` ($6,000,000) | `Roll` (140%, $2.75B) | custom view counter / $6M |
| B9 | `surface.photo_frame` (= the handoff surface) | A photo or video frame placed in the world with a frame skin, label and drop-in | asset id, x, y, w, rot, crop, skin (print / filmstrip / glass window / TV), title, label + label time | `Print` + `FilmFrame` | `Panel` (glass app window, title bar, spring, sheen) | custom polaroids; Parallax prints / REC frame |
| B10 | `label.callout` | Short mono label that types on next to a point | text, size ≥ 40 px cap, side, time | `GlowPin` label, Print label | `PriceTag`, Panel `label`, chart `dates` / `labels` | yes |
| B11 | `emphasis.mark` | One gesture of emphasis on the beat word | kind (pen circle / stamp / flash ring), color, time | `PenMark`, `Stamp` | `Flash`, `stamp` cue on crash | custom stamps |
| B12 | `connector` | Draws a relation between two points | from, to, bend / sag, width, color, dur | `StringLine`, `Route` | `ShortArrow`, `Particles` | Parallax routes |
| B13 | `field.spread` | Many points or particles to show scale or spread | points, rgb, r, times | `DotField` | `Particles` | – |
| B14 | `look.finish` | Grade, grain, glow, vignette, curve, dim, board texture | `LOOK` dict keys: board, bg, grade, grain, glow, vignette, curve, dim | `LOOK` | `LOOK` + `per_frame_grain()` | Parallax finish grade |
| B15 | `qa.text_safety` | 40 px cap gate + edge fade + audit hook | `MIN_CAP_PX = 40`, edge ramp 30 px | (missing in R1, which caused the VQ failures) | `legible()`, `edge_alpha()`, `audit.py` | – |
| B16 | `sfx.auto_cues` | Items emit cues (pop / impact / whoosh / ticks); manual risers before big moments | cue type, t, gain, dur | engine `cues()` + `film.cue` | same, plus extra risers | custom `sfx.py`, Parallax `sfx.py` (word-keyed) |
| B17 | `audio.mix` | Sidechain duck + two-pass loudnorm | duck thr 0.025, ratio 4, atk 35, rel 550; I −15, TP −1.5, LRA 11 | `mix_soundtrack.py` | same + `measure_mix.py` | Parallax loudnorm −15.2 |
| B18 | `qa.sfx_vs_speech` | Momentary loudness of each hit vs the speech median | window 0.6 s; target ≤ ~0 dB over speech (R1 VQ basis) | (VQ only) | `measure_mix.py` | – |
| B19 | `qa.render_checks` | Stills, contact sheet, motion strips, dup-frame, black/YAVG, CFR, LUFS / TP | sample times, strip windows | `sheet.py` | `stills/`, `audit.py` | Parallax `yavg.txt` |
| B20 | `render.parallel_chunks` | Chunked parallel render → lossless join → mux → small export (atomic) | workers = cpu−1 (RAM cap), crf 16; small 6 Mb/s | `render.py` | same | custom 4 segments |
| B21 | `handoff.return` | Freeze world, render only push / pull, swap the surface image still↔clip frame, dissolve / seam, splice, duck / gain, loudnorm | cut frame, push / pull frames, hold, tight pose, wobble damp, xfade frames, clip gain, bed duck | `render_transitions.py`, `assemble.py` | `build.py`, `render_seg.py` | – |
| B22 | `handoff.hardcut` | Frame-indexed splice with short audio fades | cut frame, fades 0.08–0.12 s, clip gain | `assemble.py` | `build.py` | – |
| B23 | `credits.ledger` | Assets, licences, data, facts, fonts, sound, re-render vs reuse | per asset row | `credits.txt` | `credits.txt` | all |
| B24 | `assets.commons_fetch` + manifest | Commons metadata + licence check; `photos.json` with crop + grade | id, commons title / url, crop, grade | `fetch_commons.py`, `photos.json` | same | Parallax `sources.txt` |

### 6B. PER-VIDEO VARIABLES (style-spec fields)

| Style-spec field | Keef (R1-B Cinematic) | GME (R2-B Cinematic) |
|---|---|---|
| `world.kind` | geographic map (world-atlas 50m, mercator lon0 −40) | data chart (GME daily candles on a terminal grid) |
| `world.traversal` | Chicago cluster → east across North America → "Drill" over the Atlantic → whip back west → pull wide to the world → dive back to the house | left → right along time, climbing the price spike; final extreme pull-out to the whole chart (zoom 0.118) |
| `anchor_motif` | glowing red pin + red pen circles on B&W prints | green candle spike / green "$483"; glass app windows |
| `palette` | bg (9,22,24) dark teal; land (36,70,72); cream type (240,232,214); red (214,38,30) | bg (6,8,12) near-black; GREEN (38,224,122), RED (255,72,72), AMBER (255,176,0), WHITE (240,244,248) |
| `look` | grain 0.032, glow 0.30, vignette 0.85, curve 0.26, board `teal_board.png` | grain 0.02 (per frame), glow 0.34, vignette 0.72, curve 0.22, board `term_grid.png` + Ambient color blobs |
| `photo.grade` | `bw` (toned prints) | `natural` |
| `fonts` | engine serif + mono roles | Anton (display) + IBM Plex Mono (SIL OFL) |
| `surface.skin` (photo / handoff surface) | Print with rotation + FilmFrame (film bands) | Panel = glass app window with a URL-style title ("reddit.com", "robinhood", "hearing feed") |
| `hero.type_style` | serif "2011", "DRILL"; mono DARK / SLOW / RAW | Anton slams "$17", "$483", "JAN 28", "I LIKE THE STOCK." (STOCK in green) |
| `numbers` | Counter $6,000,000 "REPORTED · THREE ALBUMS" | Roll 140% short interest; Roll $2.75B rescue; live PriceTag |
| `emphasis` | PenMark ellipses, HOUSE ARREST stamp | Flash rings, stamp + drop on the crash, ShortArrow to $0 |
| `story_components` (custom per topic) | GlowPin, Route to London / Brooklyn, DotField of 13 cities | CandleChart, Reddit card, Robinhood buy button (on → off), GemHold (diamond hands), Particles (buy rush), headline terminal |
| `data.source` | Natural Earth / world-atlas geodata + city lat/lon | Yahoo Finance chart API OHLC Dec 28 2020 – Feb 12 2021, ×4 split adjustment |
| `asset.types` | YouTube thumbnails, album covers, Commons portraits / buildings | Commons store / Capitol, YouTube thumbnails (Kitty, Gill), code-redrawn app UIs |
| `voice` | edge-tts Andrew −8% (R1) | ElevenLabs Brian, speed 0.85, 0.6 s breaks |
| `sfx.character` | 10 whoosh, 9 pop, 5 impact, 4 pencil, 2 slide, 2 riser, stamp, boom (paper / desk sounds) | 23 tick, 10 impact, 8 pop, 5 whoosh, 3 riser, 2 drop, 2 boom (terminal / market sounds) |
| `music` | none | synth E-minor drone, 96 bpm hats → kick build → hard stop at the crash → pad swell → E5 resolve |
| `camera.rhythm` | engine keys, zoom 0.2–0.86, a whip and a wide pull | Catmull-Rom momentum, drift on, zoom 0.118–0.68, slower big moves on the climb (radius 12000) |
| `fade` | in 0.6 / out 1.6 | in 0.5 / out 1.2 |
| `length` | 39.8 s, 12 lines | 52.7 s, 12 lines |
| `handoff.surface` | P02 print (the video still) inside a FilmFrame | "hearing feed" glass window (Gill) |
| `handoff.clip_audio` | music video, own audio at −8.3 dB | testimony at −24 LUFS → +8 dB; bed −8 dB |
| `handoff.timing` | push 36 fr, pull 36 fr, xfade 8 fr, world frozen | hold 24 fr, push 36 fr, pull 63 fr to the ending typography, xfade 12 fr |
| `handoff.in_point_rule` | frame = existing thumbnail; 20 beats @ 133 BPM; after lower-third | caption-located sentence |

**Read-across from the other engines:**
- The custom and Parallax versions chose the same **world kind per topic** (Keef: map board; GME: chart world).
- They needed the same blocks again (word clock, rolling number, slam type, prints / windows, synthesised word-keyed SFX, loudnorm, credits).
- Each re-implemented them from scratch (R2-A `render2.py` 34 KB, R2-C `gen.py` 30 KB). That is the cost the shared block library removes **[inferred]**.

### 6C. Blocks to build first (proposal)
1. **B1 + B2 + B3 word clock and script model.** Every other block is timed by it. Include the output-format fallback and the strict "missing word = error" rule.
2. **B4 + B5 + B6 world canvas and camera.** The GME `OrganicFilm` Catmull-Rom camera with drift, the focus spotlight, and a world adapter interface (`map`, `chart`, `board`) so a new topic swaps only the world.
3. **B9 surface.photo_frame with skins + B21 / B22 handoff.** It is the same object, so building it once gives both photo holds and RETURN. Add first / last-frame grabs (ST-TR-003) and the three bug fixes (no segment fades, frame-count parity, atomic writes).
4. **B7 hero_slam, B8 rolling_number, B10 callout, B11 emphasis.** Small, reused in all six films, and they carry most of the "pro" feel.
5. **B15 + B18 + B19 QA kit.** 40 px / edge gate, SFX-vs-speech, dup / black / CFR / LUFS, contact sheets and strips. This is what turned the R1 VQ failures into R2 passes.
6. **B16 + B17 audio:** auto cues + duck + two-pass loudnorm (−15 LUFS, TP −1.5). Add a **music-bed generator** keyed to beats (GME `music.py` pattern).
7. **B24 + B23 asset manifest and credits ledger** (Commons fetch, licence status, crop / grade, data provenance).
8. **Data adapter for B4:** market OHLC with split adjustment, and geodata places, as the first two world data sources.

---



(End of copied section. For the gap table, briefs and file index see specs/studio-reference-workflow.md §7 and the appendices.)
