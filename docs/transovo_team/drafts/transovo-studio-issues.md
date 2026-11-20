# Motion Studio: draft issues (FILED 15 Nov 2026 as 703deuce/sms #1198–#1259; BE-21 dropped)

> **DRAFTS ONLY.** No GitHub issues, branches or comments have been created. The CoS files these after John/CoS review.
> **Spec:** `specs/transovo-studio-build.md`. **Scope:** documentaries only (John, 15 Nov 2026, 12:02 AM ET). Every issue honors the TEAM.md hard rules (ST-RULE-001…006):
> - no `$` in UI;
> - additive migrations only;
> - no auto paid retries;
> - never touch the SMS worker or Coolify app3;
> - no secrets or signed URLs exposed.
>
> **Common protected behavior (applies to all issues):**
> - upload clipping, stream clipping, the editor, Story, multi-source Story, Clean Take and live B0.5 motion graphics keep working;
> - `/app/studio` (AI Studio), `/app/ad-studio` and the T2V flag-off routes are untouched (ST-PROT-001/002).
>
> **Phases (§6):**
> - **P1:** prove blocks and composition on documentaries.
> - **P2:** pipeline + QA.
> - **P3:** UI first release.

---

## Render engine (12)

### RE-1: Vendor Cinematic Skill as the pinned engine — filed #1198
- **Owner:** Render engine (Backend New)
- **Phase:** P1
- **Depends on:** SEC-2 (font/Piper licence part)
- **Scope:** vendor `Moh4696/cinematic-skill` at the pinned commit (box copy `bf435561`) with its MIT licence; Python env (skia-python ≥ 87.6, numpy, pillow, ffmpeg); `check_setup.py` in CI; replace disallowed fonts and voices.
- **Requirements:** ST-ENG-001, ST-ENG-002
- **AC:** pinned and licence vendored; `check_setup.py` passes on render boxes; licence outcome recorded per font and voice.
- **Tests:** setup smoke test; licence manifest test.
- **Protected:** B0.5 `motion_render.py` unchanged.

### RE-2: Render service + `MGD_RENDER_SEGMENT` + segment cache — filed #1199
- **Owner:** Render engine
- **Phase:** P1
- **Depends on:** RE-1, DO-1
- **Scope:** a render service on render boxes; an additive job type; content-hash segment cache; partial-render resume.
- **Requirements:** ST-ENG-003, ST-RR-001, ST-RR-003, ST-FAIL-002, ST-API-002 (render jobs)
- **Also covers (reference workflow, CoS 12:27 AM):** ST-BLK-20 `render.parallel_chunks` (workers = cpu−1 with a RAM cap, crf 16); the join and mux must pass frame-count parity (ST-RW-013, with BE-14).
- **AC:**
  - editing one scene re-renders only its segments (other hashes unchanged);
  - a killed render resumes;
  - never deployed to the SMS worker or app3.
- **Tests:** hash-stability test; resume test; deploy-target check.
- **Protected:** `RENDER_CLIP` and existing job types unchanged.

### RE-3: Shared-engine boundary + director interface hooks — filed #1200
- **Owner:** Render engine (with BE-1)
- **Phase:** P1
- **Depends on:** RE-2
- **Scope:** split shared modules (`render-engine/*`, `blocks/*`, `handoff/*`, `timeline/*`, `qa/*`) from `directors/documentary/*`; capability declaration check; **no other-format features**.
- **Requirements:** **ST-ENG-005, ST-ENG-006**
- **Two-part build (John 12:38 AM):** Also enforce the **Part 1 `core/*` vs Part 2 `generated/<projectId>/*`** split: generated code is never imported across projects, and `core/*` holds no styling constants (ST-PART-001/003).
- **AC:**
  - a CI import rule fails when shared modules import documentary code;
  - the engine rejects undeclared capabilities.
- **Tests:** lint rule test; capability-rejection test.
- **Protected:** none affected.

### RE-4: Three-layer composition + procedural background systems — filed #1201
- **Owner:** Render engine
- **Phase:** P1
- **Depends on:** RE-2
- **Scope:** scene spec with foreground hero, midground context and procedural background (≥ 3 subject families for the proof set); lighting coherence; `deliberateMinimal` with a reason; no per-scene image generation.
- **Requirements:** ST-COMP-001, ST-COMP-002, ST-COMP-003, ST-COMP-006
- **AC:** the renderer refuses scenes missing a layer without a reason; the 3 proof segments pass A14.
- **Tests:** a missing-layer fixture; an empty-background fixture flagged.
- **Protected:** none.

### RE-5: First-release blocks: maps, animated text, diagrams, charts, document treatments — filed #1202
- **Owner:** Render engine
- **Phase:** P1
- **Depends on:** RE-4
- **Scope:** L2 blocks bound to word ids; text source binding for A9.
- **Requirements:** ST-UX-124, ST-ENG-004, ST-UX-082 (technique tags), ST-QA-A4, ST-QA-A5, ST-QA-A9
- **Two-part build (John 12:38 AM):** These are Part 1 shared blocks. Their per-video look (palette, fonts, decoration) comes from the style spec and Part 2, not hard-coded.
- **Also covers (reference workflow, CoS 12:27 AM):** The named blocks ST-BLK-07 `type.hero_slam`, ST-BLK-08 `data.rolling_number` (lands on the spoken word, bound to data provenance), ST-BLK-10 `label.callout`, ST-BLK-11 `emphasis.mark`, ST-BLK-12 `connector` and ST-BLK-13 `field.spread`, with the parameters in spec §2.14 and each block's AC.
- **AC:** each of the 5 kinds renders in a proof scene, word-synced to ±1 frame and phone-legible.
- **Tests:** per-block golden frames; A4/A5 fixtures.
- **Protected:** B0.5 text templates untouched.

### RE-6: Cinematic Media Handoff module (core engine capability) — filed #1203
- **Owner:** Render engine
- **Phase:** **P1**
- **Depends on:** RE-4; BE-13 (handoff segment records); BE-9 (minimal timeline)
- **Scope:**
  - **One shared module** (`handoff/*`, no documentary logic, ST-ENG-005) implementing the four phases: ENTER (animate into the exact first frame on a surface), PLAYBACK (footage plays normally; world hidden, state preserved), EXIT (freeze the exact last frame, animate away), CONTINUITY (camera, world and timing).
  - **Surface interface:** `placement`, `geometryMapping` (homography or mesh for curved/moving surfaces), `applyTexture` that is pixel-aligned 1:1 at seams, and `surfaceEffects` that reach zero at seams.
  - **Surface kinds:** P1 builds printed photo, TV/monitor and moving newspaper page. Phone, cinema screen, billboard and floating 3D panel follow in P2 on the same interface.
  - **Deterministic seams:** one shared `transformId` (crop → reframe → grade) for the grabs and playback, and frame-accurate decode to the exact PTS (not the nearest keyframe; VFR by timestamp).
  - Asymmetric exits (logged).
  - Video-handle overlap with and without handles: eased freeze, audio trail or fade, no abrupt stops.
  - Hard cuts as zero-length handoffs with a required justification (interim D11 rule).
  - **No paid video model**: changes re-render only the handoff segment.
  - Exposed as capabilities `handoff.enter/playback/exit/continuity` (ST-ENG-006).
  - Implements the policy rows ST-TR-001…008, which the Director decides.
- **Requirements:** ST-CMH-001…013, ST-COMP-005, ST-TR-001…008, ST-TL-003, ST-UX-090/091/092, ST-ENG-005, ST-ENG-006
- **Also covers (reference workflow, CoS 12:27 AM):** ST-BLK-09 `surface.photo_frame` (skins: print / filmstrip / glass window / TV), ST-BLK-21 `handoff.return`, ST-BLK-22 `handoff.hardcut`; **segment renders turn off film fades** (ST-RW-015); **handheld wobble settles at footage seams** (ST-RW-016, ~15% damping, ≤ 1 px jitter at seams). The reference tests used dissolves; ST-CMH frame-exact seams supersede them.
- **AC:**
  - **Seams:**
    - the pixel-diff seam check (ST-CMH-014: MAD ≤ 1.0, ≥ 99.9% of pixels within ±4, PSNR ≥ 45 dB; VQ tunes) passes on the P1 proof return segment;
    - the decode-accuracy matrix passes 100% (ST-CMH-015);
    - re-renders give identical seam hashes.
  - **Surfaces and phases:**
    - a conformance test passes for each of the 3 P1 surface kinds;
    - the world-state snapshot is identical at ENTER end and EXIT start;
    - an asymmetric exit fixture passes the seam check on both sides.
  - **Audio:** the audio-tail checks (ST-CMH-016) pass for the with-handles and no-handles fixtures.
  - **Edits and integrity:**
    - an edit changes only the handoff segment's hash, and no paid video API call is made;
    - code search finds no second handoff implementation.
- **Tests:**
  - surface conformance;
  - seam pixel-diff fixtures (1-frame-off grab, crop mismatch, grade mismatch, resampled seam);
  - codec/GOP/B-frame/VFR decode matrix;
  - handle and no-handle audio fixtures;
  - determinism hash;
  - an import-boundary lint.
- **Protected:** B0.5 motion graphics and `RENDER_CLIP` unchanged.

### RE-7: Sandboxed custom-animation code runner — filed #1204
- **Owner:** Render engine (with SEC-1)
- **Phase:** P2
- **Depends on:** RE-2, SEC-1
- **Scope:**
  - hybrid model: JSON API first, then sandboxed Python against engine primitives;
  - isolation; no network or secrets;
  - CPU, memory, disk and time limits;
  - deterministic seeds;
  - framework fallback;
  - execution log.
- **Requirements:** ST-SBX-001…007, ST-UX-067, ST-UX-068
- **AC:**
  - ≥ 1 custom-code proof scene passes QA;
  - escape, network and env tests fail closed;
  - identical inputs give identical frame hashes;
  - a crash falls back to framework blocks with no paid retry.
- **Tests:** a sandbox escape suite; determinism; fault injection.
- **Protected:** none.

### RE-8: Foundation blocks: word clock, script model, world canvas, camera, finish — filed #1205
- **Owner:** Render engine
- **Phase:** **P1** (step 2–3 of the P1 order)
- **Depends on:** RE-1, RE-3
- **Scope:**
  - ST-BLK-01 `narration.tts_with_word_times` interface: consumes the existing R2 VO / an uploaded narration in P1; live ElevenLabs TTS comes via BE-8 (D6 approved, John 12:57 AM).
  - ST-BLK-02 `timing.word_clock` (a missing word raises).
  - ST-BLK-03 `script.lines` + `beats.lint` (`text`/`spoken`/`hero`/`typed`; typed-and-spoken lint).
  - ST-BLK-04 `world.canvas` with `map` / `chart` / `board` adapters.
  - ST-BLK-05 `camera.path` (Catmull-Rom, drift, breathing, wobble with a damping hook).
  - ST-BLK-06 `camera.spotlight` (one hero per beat).
  - ST-BLK-14 `look.finish` (per-frame grain).
  - Shared modules only (ST-ENG-005), exposed as capabilities (ST-ENG-006).
- **Requirements:** ST-BLK-01…06, ST-BLK-14, ST-RW-006, ST-RW-001 (lint part), ST-ENG-004, ST-ENG-005, ST-ENG-006
- **Two-part build (John 12:38 AM):** `world.canvas` is **Part 1 infrastructure only** (coordinate space, projection math, axes, tiling). There are no prebuilt `map`/`chart`/`board` world modules: world looks and content are generated fresh per video in Part 2 (RE-11). The AC "a new topic swaps only the world adapter" is replaced by "Part 2 worlds render on the canvas; the canvas holds no styling".
- **AC:**
  - each block's AC in spec §2.14;
  - camera keys hit word times ±1 frame;
  - a new topic swaps only the world adapter;
  - no duplicate consecutive frames (per-frame grain);
  - deterministic hashes.
- **Tests:** golden renders per block; missing-word test; lint test; dup-frame test.
- **Protected:** B0.5 motion graphics unchanged.

### RE-9: Bounded automated fix loop + measurement precedence — filed #1206
- **Owner:** Render engine (with QA)
- **Phase:** **P1** (step 6)
- **Depends on:** RE-2, QA-5
- **Scope:**
  - audit → fix → **re-render only the changed segments**, capped at ≤ 2 rounds per scene and ≤ 2 export-level passes, then `needs_review`;
  - **local / code re-render only**: no TTS regeneration, paid media or paid video model unless inside an explicit user-confirmed budget line; never a duplicate paid run (TEAM.md);
  - measurements override the AI watch review, and disagreements are logged.
- **Requirements:** ST-RW-010, ST-RW-009, ST-UX-068, ST-RR-001, ST-RULE-003
- **AC:**
  - fault fixtures (small text, edge clip, SFX mask, black frame) are fixed within the cap;
  - exceeding the cap gives `needs_review`;
  - zero paid calls inside the loop without a confirmed budget (test);
  - the verdict equals the measurement where one exists.
- **Tests:** loop fault-injection suite; paid-call assertion; precedence unit test.
- **Protected:** none.

### RE-10: Audio blocks + beat-keyed music bed + uploaded-music cut and duck — filed #1207
- **Owner:** Render engine (Mixer)
- **Phase:** **P1** (step 7)
- **Depends on:** RE-8
- **Scope:**
  - ST-BLK-16 `sfx.auto_cues` (synthesized, no samples; risers before big moments);
  - ST-BLK-17 `audio.mix` (sidechain duck thr 0.025 / ratio 4 / attack 35 ms / release 550 ms; two-pass loudnorm I −15, TP −1.5, LRA 11, pending D34);
  - **the default score (D27 resolved, John 12:44 AM):** a code-generated bed in the style of the GameStop reference production's `music.py` (numpy synthesis, nothing to license). A 96 bpm hat pulse enters on a story beat, a kick builds into the peak, everything cuts at the crash word, and a sparse pad swells to a resolve under the final hold. Anchors come from the word clock; "no music" is allowed. The per-video generator with variety is RE-12;
  - **user-uploaded music:** beat-aligned cuts plus ducking under narration, reusing `new-app/lib/clips/editor/beats.ts`, `beat-autocut.ts`, `worker/clips_worker/audio_render.py` (`duck_indices`, `prepare_looped_music_bed`) and `t2v/audio_duck.py`. **No licensing gate** (ToS, John 12:44 AM);
  - auto-fix hook for SFX over speech (−6 dB or shift ~150 ms).
- **Requirements:** ST-BLK-16, ST-BLK-17, ST-RW-012, ST-RW-008 (fix action), ST-AUD-002…004, ST-MUS-001 (structure), ST-MUS-003
- **AC:**
  - music events land within ±1 frame of their anchors;
  - the GME beat table reproduces the reference structure;
  - uploaded-music edits land on beats within ±1 frame and are ducked;
  - loudness within ±1 LU of the target, TP ≤ −1.5 dBTP;
  - the R1 stamp-masking fixture is fixed;
  - the music source is recorded in the credits.
- **Tests:** onset-detection fixtures; ebur128 tests; masking fixture; uploaded-music beat-cut fixture.
- **Protected:** `audio_render.py` behavior for existing products is unchanged; existing editor beat-cut tests pass.

### RE-11: Part 2 generator: fresh worlds and scene code per customer/video — filed #1208
- **Owner:** Render engine (with BE-5)
- **Phase:** P2
- **Depends on:** RE-3, RE-8, RE-7 (sandbox), BE-20 (routing)
- **Scope:**
  - generate worlds (map, price chart, timeline, etc.), scene code, per-topic components, procedural backgrounds and the music-bed plan **fresh for each video**, from the style spec (ST-STY-005), on Part 1 blocks and infrastructure;
  - reference examples (e.g. the Keef map world and GME chart world) guide the agent only; **no reusable world templates and no library promotion** (D36 superseded);
  - artifacts stored under `generated/<projectId>/*`;
  - Luna by default; a custom step switches to Sol only if needed, via per-step config (BE-20; John 12:58 AM).
- **Requirements:** ST-PART-001, ST-PART-002, ST-COMP-001, ST-UX-067, ST-UX-085, ST-SBX-001, ST-RW-012, ST-STY-005
- **AC:**
  - no Part 2 artifact is copied from another project (hash + AST-similarity check);
  - references never reach the render path;
  - the sameness check (QA-6) passes on the benchmark;
  - generated worlds pass A14 whole-frame.
- **Tests:** copy-detection fixture; reference-isolation test; benchmark runs.
- **Protected:** Part 1 blocks unchanged by generation.

### RE-12: Per-video score generator + musical variety (Part 2) — filed #1209
- **Owner:** Render engine (Mixer)
- **Phase:** P2
- **Depends on:** RE-10, RE-11, BE-16 (beat table)
- **Scope:**
  - generate the score per video from the script's beat table and tone. **Tempo, key/mode, instrumentation, mood and beat placement** are all derived, so no two scores sound the same (John 12:45 AM);
  - seeded but script-derived (seed = hash of project + script);
  - parameters logged per video; local render, no paid call.
- **Requirements:** ST-MUS-001, ST-MUS-002, ST-VAR-002 (fail action), ST-PART-002
- **AC:**
  - parameters `{bpm, key, mode, instruments, mood, anchors, seed}` are logged;
  - the same script + seed is bit-identical;
  - two different scripts yield different parameters;
  - the music sameness check (QA-6) passes.
- **Tests:** determinism test; variety fixtures; anchor-placement fixtures.
- **Protected:** Part 1 mix blocks unchanged.

## Backend (New) (21)

### BE-1: Additive data model + director registry — filed #1210
- **Owner:** Backend (New)
- **Phase:** P1 (minimal) → P2 (full)
- **Depends on:** none
- **Scope:** additive Prisma tables (ST-DM-001) incl. `StudioAsset`; a `directorRegistry` with exactly one entry (`documentary`) implementing the `Director` interface (inputs, outputs, capabilitiesUsed). Documentary-specific code lives only under `directors/documentary/*`.
- **Requirements:** ST-DM-001, ST-MR-011, **ST-ENG-005, ST-ENG-006**
- **AC:** the migration is additive only (no changes to existing tables); a contract test drives the Documentary Director through the interface only.
- **Tests:** migration test on a schema copy; registry/interface contract test.
- **Protected:** existing tables and models unchanged.

### BE-2: `/api/motion-studio/*` routes, run state machine, idempotency — filed #1211
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** BE-1, D3
- **Scope:** project CRUD, plan (Start = planning request), idempotent run, activity stream, assets, scene regenerate, proposals, export, open-in-editor; checkpoint vs fully automatic.
- **Requirements:** ST-API-001, ST-API-002, ST-UX-008, ST-UX-071, ST-WF-003, ST-RULE-003, ST-FAIL-001, ST-VIS-002
- **AC:**
  - Start queues no paid render;
  - a duplicate start returns the same run;
  - fully automatic runs with no pauses;
  - the checkpoint pauses after story + plan;
  - workspace authz.
- **Tests:** API contract tests; idempotency; job-queue assertion.
- **Protected:** `/api/studio/*` and `/api/ad-studio/*` untouched.

### BE-3: Story agent (idea → sourced script; script → organized narration) + grounded research — filed #1212
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** BE-1
- **Scope:**
  - research with source links per claim; chapters; title; WF-B preserves the user's words; Motion Studio-only editorial exception (ST-WF-004);
  - **research via Gemini grounded search (D5 resolved, John 12:42 AM)**, called only when model knowledge isn't enough or the information is new or recent; a trigger decision `{query, grounded, reason}` is logged per query;
  - citations are captured into the provenance ledger;
  - frugal use: caps, cache and de-dup, with **no automatic paid retries**;
  - a thin grounding wrapper on the existing Gemini client (`new-app/lib/server/ai/gemini.ts`); none exists today.
- **Requirements:** ST-WF-001, ST-WF-002, ST-WF-004, ST-UX-022, ST-UX-061, ST-UX-062, ST-UX-110, ST-UX-121, ST-UX-123, ST-RES-001…003
- **Decision resolved:** D5 (John 12:42 AM: Gemini grounded search). No longer blocked.
- **AC:**
  - every factual claim from research has ≥ 1 source URL;
  - 100% of research queries have a logged trigger decision;
  - the recent-event fixture grounds and the stable-knowledge fixture doesn't;
  - a failed grounded call triggers no automatic re-request;
  - a script diff = 0 by default;
  - existing Story / Clean Take prompts unchanged (test).
- **Tests:** claim-source test; trigger fixtures; cache and cap tests; prompt-isolation test.
- **Protected:** `multi-source-story.ts`, `clean-take.ts` prompts unchanged.

### BE-4: AI Media Researcher agent + automatic media finding (LATER) — filed #1213
- **Owner:** Backend (New)
- **Phase:** **Later (John 12:33 AM)**. Fully specced, not in v1.
- **Depends on:** BE-1, D4, D5, SEC-2
- **Scope:**
  - entity research;
  - multi-provider search (Pixabay via `BrollSearchCache`, Pexels if a key exists, Commons, the provider chosen under D5);
  - visual-analysis previews;
  - licence enum and export gate;
  - permitted downloads only;
  - alternatives for flagged media;
  - organization by chapter, person, event and use;
  - budgets with no auto paid retries;
  - failure tolerance;
  - honors `mediaPolicy`.
- **Requirements:** ST-MR-001…015, ST-UX-063, ST-UX-064, ST-UX-111, ST-UI-101 (policy), ST-UI-106
- **Scope change (John 12:33 AM, v1 media = user uploads only):** The whole Media Researcher, automatic finding (Commons incl. the ST-BLK-24 fetch, Pixabay, Pexels, YouTube, yt-dlp), licensing automation and the media-source choice are later. It is no longer a v1 blocker. When revived it still needs D5 (provider), D4/SEC-5 (terms) and the D29 rules.
- **AC:**
  - `uploads_only` ⇒ zero external calls;
  - no export with a non-cleared status;
  - the cap is enforced;
  - a provider 500 still completes with a gap list.
- **Tests:** licence-enum matrix; budget cap; fault injection; cache-hit test.
- **Protected:** existing `/api/clips/broll/search` behavior unchanged.

### BE-5: Documentary Director (plan, style spec, transitions, footage modes) — filed #1214
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** BE-1, BE-3, BE-4, RE-3
- **Scope:**
  - **derive the world type, scene list, style spec (Table B) and emphasis words from the story's subject and structure (ST-DIR-001, John 12:49 AM)**, with reasons logged to Production Activity;
  - visualType per scene with a reason;
  - master visual plan incl. transitions;
  - style spec and distance check;
  - footage mode (a)/(b) per D7;
  - insert proposals per D8;
  - implements the `Director` interface;
  - declares capabilities.
- **Requirements:** ST-DIR-001, ST-UX-065, ST-UX-066, ST-UX-112, ST-STY-001…004, ST-AG-001…004, ST-BND-002, ST-TR-001, ST-TR-006, ST-TR-007, ST-TR-008, ST-AUD-001, ST-AUD-002, ST-UX-025, ST-ENG-006
- **Scope change (John 12:33 AM, v1 media = user uploads only):** BE-4 is later. In v1 the Director works from the **uploads catalog** (ST-MR-011) produced by BE-7 analysis; the dependency on BE-4 becomes "uploads catalog".
- **AC:**
  - 100% of plan entries have reasons;
  - 6 similar prompts pass distance;
  - found ≠ used test passes.
- **Tests:** plan schema; distance; found ≠ used.
- **Protected:** none.

### BE-6: Footage Editor adapter (WHAT) — filed #1215
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** BE-5
- **Scope:** call Story / multi-source Story / Clean Take to select moments (in/out word ids + frame indices); clip trim and sound go through this adapter.
- **Requirements:** ST-BND-001, ST-BND-003, ST-UX-011, ST-UX-054 (clip trim), ST-AG-003
- **AC:** the Motion Designer can't write cut ranges; existing footage-logic tests unchanged.
- **Tests:** boundary test; regression run of existing suites.
- **Protected:** Story, multi-source Story, Clean Take.

### BE-7: Upload understanding by reusing the clipper analysis + face grouping (named gaps only) — filed #1216
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** BE-1, SEC-3 (parallel, not blocking)
- **Scope (John 12:42 AM: "that's not anything new"): reuse existing modules and extend only the named gaps.**
  - **Reuse:**
    - transcription: `MEDIA_TRANSCRIBE` (`worker/clips_worker/media_transcribe_job.py`, `transcribe_provider.py`, `deepgram_transcribe.py` with speakers; `new-app/lib/server/clips/media-transcripts.ts`);
    - audio: `audio_extract.py`, `scan.py`, `ai_producer_agent/audio_energy.py`, `silence_trim.py`, `MEDIA_SYNC`;
    - vision and scenes: the Gemini video watch `ai_producer_agent/finder/watch.py` via `AI_PRODUCER_AGENT_ANALYZE`, plus `new-app/lib/ai-producer-agent/visual-evidence.ts` (as used by `run-multi-source-story.ts` / `run-clean-take.ts`), `clip_classify.py`, `t6_scenes.py`, `vision_layout.py`, `screen_share_detect.py`, `reframe_core.detect_shots`;
    - faces: `reframe_core.py` (`track_faces`, re-ID `assign_people`), `t6_cv.py`;
    - storage: `new-app/lib/server/clips/project-media.ts`.
  - **Gaps (the only new code):**
    - G1 still-image analysis (extend `gemini-flash-lite.ts` / `gemini-inline-image.ts`);
    - G2 face grouping across uploads and stills, project-scoped;
    - G3 on-screen text/OCR (extend the watch schema);
    - G4 persist to the Motion Studio catalog;
    - G5 a Motion Studio-owned flag; never flip `AI_PRODUCER_AGENT_ENABLED`;
    - G6 transcription cost inside the Motion Studio allowance (credits only).
  - Don't reuse the placeholder `ai_producer_agent/visual.py`.
  - Optional identity labels; identity suggestions with verification; deletion with the project.
- **Requirements:** ST-UPA-001, ST-UPA-002, ST-FACE-001…006, ST-UX-063, ST-MR-011 (catalog of uploads), ST-MR-015 (later, with BE-4)
- **AC:**
  - code review confirms every analysis step calls an existing job or function; new code is G1–G6 only;
  - an uploaded interview yields transcript, speakers, shots, tags, faces and on-screen text in the catalog; a still yields a description, people and text;
  - grouping precision ≥ 0.9 / recall ≥ 0.8 (VQ tune);
  - an unverified name never renders;
  - no embeddings remain after project delete;
  - **regression:** existing clipper suites pass unchanged (`worker/tests/test_e5b_transcribe.py`, `test_deepgram_transcribe.py`, `test_scan.py`, `test_reframe_*.py`, `test_detect_facecam_sampling.py`, `test_stream_*.py`, `new-app/tests/ai-producer-agent/*`), and golden outputs for upload clipping, stream clipping, Story, multi-source Story and Clean Take are unchanged (QA-2).
- **Tests:** reuse-only review checklist; catalog fixtures; grouping eval; unverified-name test; deletion test; clipper regression.
- **Protected:** upload clipping, stream clipping, Story, multi-source Story, Clean Take, reframe/facecam detection.

### BE-8: Narration (documentary preset, upload own, alignment): ElevenLabs only — filed #1217
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** none (D6 approved, John 12:57 AM)
- **Scope:**
  - a configurable preset (voice resolved by name "Brian", speed ~0.85, pauseMs), behind flag `studioNarrationPreset` (D6 approved, John 12:57 AM; it may be turned on);
  - "Upload own" audio → transcription (`MEDIA_TRANSCRIBE`) → A1;
  - TTS word alignment.
  - **ElevenLabs only (D28 resolved, John 12:44 AM):** no Edge or free TTS voices, no edge-tts path, and Piper is never used for product narration.
- **Requirements:** ST-AUD-005…008, ST-UX-026, ST-RW-002, ST-BLK-01
- **Also covers (reference workflow, CoS 12:27 AM):** ST-RW-002 TTS output-format / plan fallback that stays **within ElevenLabs** and is **not a paid retry**: probe first; one re-request at the next ElevenLabs format, only after a rejection that generated and billed nothing; never after a billed generation; never another provider. ST-BLK-01 parameters. D31 confirmation.
- **AC:**
  - TTS calls use speed 0.85 when the preset is on;
  - no voice id is hard-coded;
  - no non-ElevenLabs TTS call path exists (test);
  - uploaded narration aligns (A4).
- **Tests:** preset config test; provider-allowlist test; fallback fixtures; alignment test.
- **Protected:** the T2V George default unchanged.

### BE-9: Master timeline model + assembly + mix + editor round trip — filed #1218
- **Owner:** Backend (New)
- **Phase:** P1 (minimal) → P2
- **Depends on:** BE-1, RE-2
- **Scope:** the timeline schema (parametric graphics segments); track mapping; assembly job `DOC_ASSEMBLE`; mix (reuse `audio_render.py`); `ClipEditsV2` conversion for "open in advanced editor"; MP4 export.
- **Requirements:** ST-TL-001…004, ST-AUD-003, ST-AUD-004, ST-UX-069, ST-UX-070, ST-UX-125, ST-QA-A7, ST-QA-A13
- **AC:** the export renders from the timeline alone; the round trip keeps segments; loudness ±1 LU and TP ≤ −1 dBTP.
- **Tests:** round trip; loudness; mode levels.
- **Protected:** existing editor projects open unchanged.

### BE-10: AI Director chat: proposed changes, accept/reject, per-scene regenerate — filed #1219
- **Owner:** Backend (New)
- **Phase:** P3
- **Depends on:** BE-5, RE-2
- **Scope:** intent → proposed change list (nothing applied until accepted); diff apply with undo (registry pattern); scene-only regenerate.
- **Requirements:** ST-UX-043, ST-UX-085, ST-UX-100, ST-UX-101, ST-RR-002, ST-VIS-003
- **AC:**
  - the project is unchanged until Accept;
  - a regenerate touches one scene;
  - undo works.
- **Tests:** proposal lifecycle; one-job regenerate.
- **Protected:** the editor command registry contract unchanged.

### BE-11: Allowance estimator (credits/minutes, no `$`) — filed #1220
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** D1, D2
- **Scope:** estimate before full render; itemized included vs third-party; confirm paid items.
- **Requirements:** ST-CRD-001, ST-CRD-002, ST-UX-128, ST-RULE-001
- **AC:** estimate within ±15% of actual on the benchmark; no `$`.
- **Tests:** estimator test; `$` scan.
- **Protected:** existing credit ledger unchanged.

### BE-12: Production activity events + observability — filed #1221
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** BE-2
- **Scope:** `StudioActivityEvent`; structured logs (no secrets); metrics.
- **Requirements:** ST-OBS-001…003, ST-UI-104 (data), ST-RULE-005
- **AC:** an event fires per step transition; the log scrub test passes.
- **Tests:** event-stream test; scrub test.
- **Protected:** none.

### BE-13: Handoff segment records in the master timeline model — filed #1222
- **Owner:** Backend (New)
- **Phase:** **P1**
- **Depends on:** BE-1, BE-9
- **Scope:**
  - An additive handoff segment record (ST-CMH-017): clip asset; in/out frame index + PTS; `transformId`; surface kind and params; enter/playback/exit ranges; world-state refs in/out; exit style + presentation reason; cut type/purpose/justification; handles; audio-tail mode and ms; seam scores; `decodeVerified`; render hash.
  - The timeline validator enforces:
    - a justification is required on every hard cut;
    - a continuation cut must pass alignment;
    - an export is refused if any handoff lacks seam scores or `decodeVerified`.
  - Timeline API round trip; mapping to `ClipEditsV2` for "open in advanced editor" (handoffs export as rendered segments with a back-reference).
  - For Motion Studio, supersedes the MGD Appendix B transitionIn/Out frame-grab fields.
- **Requirements:** ST-CMH-012, ST-CMH-017, ST-TL-001, ST-TL-003, ST-TL-004, ST-TR-006, ST-DM-001
- **AC:**
  - the schema validates;
  - a migration test confirms the change is additive only;
  - the validator rejects an unjustified hard cut and a misaligned continuation cut;
  - an export is blocked when `decodeVerified=false`;
  - the round trip preserves all fields.
- **Tests:** schema and validator unit tests; migration test; API round trip; ClipEditsV2 mapping test.
- **Protected:** existing editor projects and tables unchanged.

### BE-14: Export integrity: frame-count parity, atomic writes, small export — filed #1223
- **Owner:** Backend (New)
- **Phase:** **P1** (step 4)
- **Depends on:** RE-2
- **Scope:**
  - every segment, join, mux and export checks rendered == muxed == expected frames (audio padded or trimmed to the video, **never `-shortest`**);
  - temp file then atomic rename for every write; temp cleanup on failure; readers never see partial files;
  - small export (6 Mb/s) and master (crf 16) as in ST-BLK-20.
- **Requirements:** ST-RW-013, ST-RW-014, ST-BLK-20, ST-FAIL-002
- **AC:**
  - the 1194 → 1193 fixture is caught and fixed;
  - a concurrent reader never sees a partial or 0-byte file;
  - a killed export leaves nothing under the final name.
- **Tests:** parity fixture; concurrent-reader test; kill test.
- **Protected:** the existing `RENDER_CLIP` export path unchanged.

### BE-15: Data adapters (user-provided or grounded research only) + data provenance + asset manifest / credits ledger — filed #1224
- **Owner:** Backend (New)
- **Phase:** **P1** (steps 8–9)
- **Depends on:** BE-1
- **Scope (D26 dropped, John 12:42 AM: the product doesn't fetch market data):**
  - data adapters accept **user-provided data** (pasted table, CSV or sheet) or **grounded research results with citations** (BE-3) only;
  - no market-price adapter and no Yahoo dependency;
  - corporate-action (split) adjustment only when the source says the series is unadjusted;
  - place coordinates from user input or research;
  - provenance record `{origin: user or research, citation URLs, retrievedAt, range, adjustments, approximate}`;
  - narrated numbers verified against the data;
  - ST-BLK-24 manifest of uploads (crop, grade), with **no licence fields required** (John 12:44 AM);
  - ST-BLK-23 credits ledger generated per export.
  - P1 proofs use hand-entered internal test data, labelled internal.
- **Requirements:** ST-RW-003, ST-BLK-23, ST-BLK-24, ST-QA-A10, ST-RES-002
- **AC:**
  - the split-adjustment fixture passes on a user-provided series;
  - narrated values match the data or are flagged;
  - every data-bound block references provenance;
  - no outbound market-data request exists (test);
  - uploads save with no licence fields;
  - the credits ledger lists data and citations, generated music and SFX, fonts, and re-rendered vs reused.
- **Tests:** adapter fixtures; verification test; no-fetch test; ledger snapshot.
- **Protected:** existing `StockAsset` / B-roll paths unchanged.

### BE-16: Narration-writing rules in the Story agent — filed #1225
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** BE-3 (idea flow), RE-8 (script model)
- **Scope:**
  - spoken-form numerals in `spoken`;
  - `text` / `spoken` split;
  - typed-vs-spoken lint resolution;
  - one beat per sentence, ellipsis suspensions, fragments for rhythm;
  - target 120–125 wpm with longer section pauses;
  - WF-B keeps the user's `text` verbatim and normalizes only `spoken`.
- **Requirements:** ST-RW-001, ST-WF-002
- **AC:**
  - number/date round-trip tests;
  - measured pace 115–130 wpm (VQ tunes);
  - the user-script diff of `text` = 0.
- **Tests:** normalization unit tests; pace measurement on fixtures.
- **Protected:** Story / Clean Take prompts unchanged.

### BE-17: Uploaded-clip quote location + beat-aligned in/out (reuse) — filed #1226
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** BE-6, BE-7
- **Scope:**
  - locate a quoted line in **uploaded** clips by reusing the existing `MEDIA_TRANSCRIBE` output (word-timed `ClipWord`s via `new-app/lib/server/clips/media-transcripts.ts`); no new transcription path;
  - musical-beat detection by reusing `new-app/lib/clips/editor/beats.ts` / `strong-beats.ts`, with in/out snapped to beats or phrases for music clips;
  - combined with first-frame match and packaging avoidance.
  - **Gap (the only new code):** quote-text → word-span matching over the existing words.
  - Found-clip transcription moved to BE-19 (later, John 12:33 AM).
- **Requirements:** ST-RW-004 (uploaded-clip part), ST-RW-005, ST-TR-005, ST-AUD-007, ST-UPA-001, ST-UPA-002
- **AC:**
  - the quote is located within ±1 word on an uploaded-clip fixture;
  - in/out within ±1 frame of the beat grid;
  - `test_e5b_transcribe.py` and the editor beat tests pass unchanged.
- **Tests:** quote-match fixture; BPM fixture; regression.
- **Protected:** `MEDIA_TRANSCRIBE` and upload clipping unchanged.

### BE-18: Agent brief content standard — filed #1227
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** BE-1
- **Scope:** a typed brief schema for Director → Motion Designer / Media Researcher / Footage Editor, with fields from reference workflow §4.2: topic + angle + length, engine version, script rules, voice, asset rules, look rules, QA expectations, deliverables, hard rules. The Appendix A wording is illustrative; the real brief texts come from the CoS (D33).
- **Requirements:** ST-RW-017, ST-AG-003
- **AC:** briefs validate; a missing required field is rejected.
- **Tests:** schema tests.
- **Protected:** none.

### BE-19: Found-clip transcription to locate quotes (LATER) — filed #1228
- **Owner:** Backend (New)
- **Phase:** **Later (John 12:33 AM)**. Fully specced, not in v1.
- **Depends on:** BE-4 (later), SEC-5
- **Scope:** ASR or provider captions for **permitted found** clips (non-upload) to locate a quoted line (the GME pattern: captions located the quote at 5:00.32–5:08.80); only for clips whose licence permits processing.
- **Requirements:** ST-RW-004 (found-clip part), ST-MR-005
- **AC:** the quote is located within ±1 word on a found-clip fixture; no processing of restricted media.
- **Tests:** caption/ASR fixture; licence-gate test.
- **Protected:** `MEDIA_TRANSCRIBE` unchanged.

### BE-20: Model routing (Luna / Sol) + per-step failure logging dashboard — filed #1229
- **Owner:** Backend (New)
- **Phase:** P2
- **Depends on:** BE-1, BE-12
- **Scope:**
  - a per-step model router: **Luna is the default for Part 1 and Part 2** (John 12:58 AM: "Just put Luna for both right now"); a custom step switches to Sol only if needed, by per-step config or a **configurable escalation trigger** per step (QA/VQ fail count, fix-loop iterations, sandbox failures, manual override) that escalates **that step only** to GPT-6.1 Sol;
  - escalation stays inside the run's confirmed model budget and is never an automatic paid retry outside it;
  - switching a step's default model is a config change;
  - per-step metrics and dashboard: QA/VQ fail rate, fix-loop count, sandbox failures, escalations and whether they passed, tokens/time (no prompts, secrets or customer content).
  - Model prices are CoS-reported, unverified and internal only; none appear in the product.
- **Requirements:** ST-MOD-001, ST-MOD-002, ST-MOD-003, ST-RULE-003, ST-OBS-003
- **AC:**
  - the router config covers every step;
  - an escalation fixture escalates only the failing step and logs the reason;
  - the budget cap is enforced;
  - the dashboard shows per-step Luna pass and escalation rates;
  - metrics cover 100% of model calls.
- **Tests:** router unit tests; escalation fixture; budget test; metrics scrub test.
- **Protected:** existing LLM clients (`new-app/lib/server/ai/*`) used, not forked.

### BE-22: Optional ElevenLabs-generated music tier — filed #1230
- **Owner:** Backend (New) (audio)
- **Phase:** P2
- **Depends on:** D37 spend OK (John), D2 credit price (John), RE-10 (cut and duck path)
- **Scope:**
  - an optional, higher-priced music option, reusing the `MUSIC` job (`worker/clips_worker/music_job.py`, ElevenLabs compose + upload);
  - output cut and ducked to the story beats like the default (RE-10 path);
  - credits only in the UI, priced by John under D2;
  - flag off until D37; one paid generation per explicit user action, with an idempotency key;
  - **no automatic paid regeneration** (a sameness fail goes to review).
- **Requirements:** ST-MUS-004, ST-VAR-002, ST-RULE-001, ST-RULE-003
- **AC:**
  - flag off by default; no paid call while off;
  - credits shown, never `$`;
  - a duplicate start does not create a second paid call;
  - output beat-cut and ducked.
- **Tests:** flag test; idempotency test; `$` scan; beat-cut fixture.
- **Protected:** existing `MUSIC` job behavior unchanged.

## Frontend (12)

### FE-1: Create screen — filed #1231
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** BE-2, D3
- **Scope:** all exact labels:
  - title, "My projects", headline, subhead, prompt placeholder;
  - "Add photos, footage, script or audio" (files + folders);
  - "Start";
  - the three mode tiles;
  - "Where should we get the media?" with its 3 options;
  - optional uploads;
  - the "Selected workflow" line;
  - documentary-only (no format picker).
- **Requirements:** ST-UX-001…015, ST-UI-101, ST-UI-102, ST-UI-103, ST-WF-005, ST-VIS-001
- **Scope change (John 12:33 AM, v1 media = user uploads only):** "Where should we get the media?" is **hidden** in v1. `mediaPolicy` is fixed to `uploads_only` (ST-UI-107). The three picker labels stay specced behind a flag (later, ST-UI-101). The "Selected workflow" line covers 3 modes × uploads.
- **AC:** label snapshot; 3×3 workflow-line snapshots; Start → planning request.
- **Tests:** snapshot + E2E.
- **Protected:** `/app` launcher cards keep working.

### FE-2: Project setup — filed #1232
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** FE-1, D13
- **Scope:**
  - Documentary length 3/5/10/15 (10/15 per D13);
  - Visual direction (4);
  - Voiceover;
  - Format;
  - Media (reconciled with the picker);
  - "Next: Create production plan" + helper;
  - title edit;
  - "Example project" badge (D15).
- **Requirements:** ST-UX-020…030
- **Scope change (John 12:33 AM, v1 media = user uploads only):** The Media row is shown read-only as "Use only my uploaded media". The concept label "Use uploads + licensed assets" (ST-UX-028) is later.
- **AC:** exactly the five settings; exact labels.
- **Tests:** snapshot; policy-sync test.
- **Protected:** none.

### FE-3: Workspace shell (four areas, stage-aware) — filed #1233
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** BE-2
- **Scope:**
  - left: PROJECT nav (Story/Media/Scenes/Graphics/Audio) + AI Director;
  - center: preview (largest), time display, "Current scene";
  - right: INSPECTOR;
  - bottom: Storyboard/Timeline.
- **Requirements:** ST-UX-040…045, ST-UX-057, ST-UX-130, ST-UX-132, ST-UX-013
- **AC:** the preview is the largest at ≥ 1280 px; create → export without opening the timeline.
- **Tests:** layout tests; E2E.
- **Protected:** none.

### FE-4: Visual storyboard — filed #1234
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** FE-3, BE-5
- **Scope:** "Visual Storyboard", "Chapter N of M"; cards (timestamp + title, treatment, description, technique tags, thumbnail); "Select a scene to edit or regenerate."
- **Requirements:** ST-UX-080…084, ST-UX-123
- **AC:** card count = scenes; fields from the record.
- **Tests:** snapshot; select → seek + inspector.
- **Protected:** none.

### FE-5: Contextual inspector — filed #1235
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** FE-3, RE-2
- **Scope:**
  - "Scene graphics", "Timing", "Style", "Camera movement", "Text";
  - "Regenerate graphic", "Edit timeline";
  - per-type controls (chart; photo crop/depth/animation; clip trim/sound);
  - transition toggle (RETURN / cut).
- **Requirements:** ST-UX-046…054, ST-TR-002
- **AC:** each change re-renders only its segment.
- **Tests:** per-type control tests.
- **Protected:** none.

### FE-6: Timeline view + advanced-editor handoff — filed #1236
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** BE-9
- **Scope:** tracks VIDEO/GRAPHICS/VOICE/MUSIC; expand; "open in advanced editor".
- **Requirements:** ST-UX-055, ST-UX-056, ST-UX-070, ST-UX-102
- **AC:** exact track labels; the handoff opens the full editor.
- **Tests:** E2E handoff.
- **Protected:** the full editor unchanged.

### FE-7: AI Director chat + "Proposed changes" — filed #1237
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** BE-10
- **Scope:** chat panel; proposed-change list with Accept/Reject (each/all); undo.
- **Requirements:** ST-UX-043, ST-UX-100, ST-UX-101, ST-UX-085
- **AC:** nothing applies before Accept.
- **Tests:** lifecycle E2E.
- **Protected:** none.

### FE-8: Production Activity view — filed #1238
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** BE-12
- **Scope:** the six stages + the six activity steps with counts; no spinner-only states.
- **Requirements:** ST-UI-104, ST-UX-060
- **Scope change (John 12:33 AM, v1 media = user uploads only):** The "media candidates discovered and cataloged" step is hidden in v1; "uploads analyzed" covers media.
- **AC:** no spinner-only state > 3 s.
- **Tests:** event-driven UI test.
- **Protected:** none.

### FE-9: Media Library (mid-production inspect/replace) — filed #1239
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** BE-4
- **Scope:** catalog view (source URL, attribution, licence status, use, chapter, person groups, flags, alternatives); replace; optional labels.
- **Requirements:** ST-UI-105, ST-UI-106, ST-UX-042 (Media), ST-UX-064, ST-FACE-002
- **Scope change (John 12:33 AM, v1 media = user uploads only):** v1 shows uploads and their analysis, and Replace swaps in another upload. Found-media source URL, licence flags and alternatives are later.
- **AC:** opens during an active run; replace re-renders affected scenes only.
- **Tests:** E2E.
- **Protected:** none.

### FE-10: Checkpoint vs fully automatic + review/export + allowance panel — filed #1240
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** BE-2, BE-11
- **Scope:** mode choice; checkpoint approval after story + plan (approve / request changes, with source links shown); review; MP4 export; allowance panel (credits/minutes, no `$`).
- **Requirements:** ST-UX-062, ST-UX-070, ST-UX-071, ST-UX-126, ST-UX-128, ST-WF-003, ST-RULE-001
- **AC:** `$` scan passes; export works.
- **Tests:** E2E both modes.
- **Protected:** none.

### FE-11: Mobile tabs — filed #1241
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** FE-3…FE-7
- **Scope:** at < 768 px: Chat / Storyboard / Preview / Timeline tabs, shared state.
- **Requirements:** ST-UX-058, ST-UX-131
- **AC:** tabs switch without reload.
- **Tests:** viewport E2E.
- **Protected:** none.

### FE-12: Route, nav, outcome card, landing — filed #1242
- **Owner:** Frontend
- **Phase:** P3
- **Depends on:** D3 (superseded and resolved by John 12:53 AM: Motion Studio)
- **Scope:** `/app/motion-studio` (v1 entry `/app/motion-studio/new?type=documentary`; John 12:53 AM, supersedes D3 `/app/documentary`; distinct from AI Studio `/app/studio`), an outcome card on `/app`, a nav entry (`new-app/lib/routes.ts`, `components/shell/sidebar-nav.tsx`), a landing page with the vision statement.
- **Requirements:** ST-VIS-001, ST-PROT-002, ST-UX-003
- **AC:** existing routes snapshot unchanged.
- **Tests:** route tests.
- **Protected:** `/app/studio`, `/app/ad-studio`.
- **Also covers (John 12:53 AM):** ST-UI-108, a premium front end consistent with the rest of the app. All Motion Studio screens use `new-app/components/ui/*` (shadcn, `components.json`) and the theme tokens in `new-app/app/globals.css`; no parallel component library and no hard-coded colors (grep test). Frontend owns it.

## DevOps (2)

### DO-1: Render pool capacity + sandbox runtime infra — filed #1243
- **Owner:** DevOps
- **Phase:** P1
- **Depends on:** none
- **Scope:** render boxes with skia-python, ffmpeg and fonts; container runtime for the sandbox (no network); render seconds per output minute measured on the proof set. **Never the SMS worker or Coolify app3.**
- **Requirements:** ST-ENG-003, ST-SBX-002…004, ST-OBS-003, ST-RULE-004
- **AC:** the proof set renders on the pool; deploy-target CI check.
- **Tests:** infra smoke.
- **Protected:** SMS worker and app3 untouched.

### DO-2: Storage/retention for catalog + segment cache; render CI smoke — filed #1244
- **Owner:** DevOps
- **Phase:** P2
- **Depends on:** BE-1, RE-2
- **Scope:** buckets/prefixes, retention, deletion with the project (incl. face data); a CI render smoke test.
- **Requirements:** ST-FACE-005, ST-RR-001, ST-RULE-005
- **AC:** delete removes the assets; signed URLs never logged.
- **Tests:** deletion test; log scrub.
- **Protected:** existing storage paths.

## QA (7)

### QA-1: Concept acceptance suite (every ST-UX) — filed #1245
- **Owner:** QA
- **Phase:** P3
- **Depends on:** FE-*
- **Scope:** one test per ST-UX-001…133 and ST-UI-101…106, incl. exact-label snapshots.
- **Requirements:** all ST-UX, ST-UI
- **Scope change (John 12:33 AM, v1 media = user uploads only):** The ST-UI-101 (picker) and ST-UI-106 tests run flag-on only (later). v1 tests ST-UI-107.
- **AC:** 100% of IDs have a passing test before release.
- **Tests:** this suite.
- **Protected:** n/a.

### QA-2: Protected-mode regression + hard-rule checks — filed #1246
- **Owner:** QA
- **Phase:** P1–P3 (every merge)
- **Depends on:** none
- **Scope:** upload clipping, stream clipping, the editor, Story, multi-source Story, Clean Take, B0.5 live graphics, AI Studio, Ad Studio; `$` scan; additive-migration check; secret scrub.
- **Also covers (John 12:42 AM reuse):** golden-output and suite checks for upload clipping, stream clipping, Story, multi-source Story and Clean Take whenever Motion Studio integrates the clipper analysis (ST-UPA-002); the "no licence gate on uploads" check (ST-RULE-007).
- **Requirements:** ST-PROT-001/002, ST-RULE-001…007, ST-UPA-002
- **AC:** suites pass unchanged.
- **Tests:** regression suite.
- **Protected:** all listed.

### QA-3: End-to-end idea→MP4 and script→MP4 (checkpoint + fully automatic) — filed #1247
- **Owner:** QA
- **Phase:** P2–P3
- **Depends on:** BE-2…BE-9
- **Scope:** 5-minute E2E per workflow and mode (idea runs use grounded research per BE-3); fault injection per stage; idempotency.
- **Requirements:** ST-UX-012, ST-UX-110, ST-UX-127, ST-WF-001…003, ST-FAIL-001/002, ST-VIS-002, ST-RES-001
- **Decision resolved:** D5 (John 12:42 AM). Release-gate runs still wait for the D17 action (benchmark footage + reviewer).
- **AC:** all pass on the benchmark.
- **Tests:** E2E suite.
- **Protected:** n/a.

### QA-4: Handoff automated test suite (seam, decode accuracy, audio tail) — filed #1248
- **Owner:** QA
- **Phase:** **P1**
- **Depends on:** RE-6, BE-13
- **Scope:** a CI suite for the handoff module.
  - **Pixel-diff seam checks** at ENTER→PLAYBACK, PLAYBACK→EXIT and continuation cuts (proposed MAD ≤ 1.0, ≥ 99.9% of pixels within ±4, PSNR ≥ 45 dB; VQ tunes).
  - **Decode-accuracy matrix** on compressed sources: long-GOP H.264 and HEVC, B-frames, open GOP, VFR phone footage. The extracted frame must equal the frame displayed at the boundary.
  - **Audio-tail checks:** no clicks (no transient > 6 dB above the local 10 ms RMS within ±20 ms of an edit), no abrupt stops (≤ −40 dBFS via a fade or tail ≥ 150 ms), trail or fade present with handles.
- **Requirements:** ST-CMH-014, ST-CMH-015, ST-CMH-016, ST-QA-A13, ST-QA-A15
- **AC:** every seeded fixture is caught; the matrix passes 100%; the suite runs on every handoff-module change.
- **Tests:** this suite.
- **Protected:** n/a.

### QA-5: Reference-workflow QA kit: edge clipping, SFX vs speech, frame parity, text safety, render checks — filed #1249
- **Owner:** QA
- **Phase:** **P1** (step 6)
- **Depends on:** RE-8, RE-10, BE-14
- **Scope:**
  - **A18** text edge clipping (30 px ramp; audit lists CUT strings);
  - **A19** SFX vs speech (EBU momentary 400 ms per 0.6 s cue window vs the speech median; ≤ 0 dB proposed);
  - **A20** frame-count parity;
  - ST-BLK-15 text safety (≥ 40 px cap at 1080p, fade instead of render);
  - ST-BLK-19 render checks (contact sheet, strips −400/+800 ms around hit words, black/YAVG, freeze, duplicate frames, CFR, LUFS/TP);
  - measurement precedence over the watch model.
- **Requirements:** ST-RW-007, ST-RW-008, ST-RW-009, ST-RW-013, ST-BLK-15, ST-BLK-18, ST-BLK-19, ST-QA-A5
- **AC:** the "LONDON clipped", R1 stamp-masking and 1194→1193 fixtures are all caught; A18 and A20 are hard gates; reports store the measurement alongside the watch-model claim.
- **Tests:** this suite.
- **Protected:** n/a.

### QA-6: Cross-customer sameness check, visuals + music (custom output varies) — filed #1250
- **Owner:** QA (with Video Quality)
- **Phase:** P2
- **Depends on:** RE-11, BE-1
- **Scope:**
  - compare each new video's worlds and scenes against recent outputs (other customers' anonymized fingerprints and house references) using **perceptual/structural similarity on keyframes** (perceptual hash + SSIM on sampled frames per scene, plus a layout/structure descriptor) and **style-spec distance** (ST-STY-003);
  - proposed threshold: fail at ≥ 0.85 SSIM-equivalent (VQ tunes);
  - fail action: regenerate only that Part 2 element and re-render locally, ≤ 2 times, model calls only within the confirmed budget, otherwise `needs_review`;
  - reconciled with ST-STY-003/004 (both must pass).
  - **Music (John 12:45 AM):**
    - generated scores (the default bed and the ElevenLabs tier) are compared using audio feature distance (chroma, tempo and MFCC statistics) plus an audio fingerprint match; threshold for VQ to tune;
    - fail action: regenerate the bed locally with varied parameters, ≤ 2 times, else `needs_review`;
    - the ElevenLabs tier is never auto-regenerated with spend;
    - user-uploaded music is excluded.
- **Requirements:** ST-VAR-001, ST-VAR-002, ST-MUS-002, ST-STY-003, ST-STY-004, ST-PART-002
- **AC:**
  - re-using the GME chart world for a new finance video fails, and a fresh world passes;
  - only the failing element regenerates;
  - a copy of the GME bed in a new project fails and a fresh bed passes;
  - fingerprints only, never another customer's media (privacy test).
- **Tests:** sameness fixtures; regeneration-scope test; privacy test.
- **Protected:** n/a.

### QA-7: Director derivation fixture test (different stories → different worlds) — filed #1251
- **Owner:** QA (with Video Quality)
- **Phase:** P2
- **Depends on:** BE-5, BE-12
- **Scope:**
  - fixture-based test of ST-DIR-001 (John 12:49 AM: "it needs to decide... and change it, so it's not all the same");
  - two **internal-only** fixture scripts with different subjects: a Keef-like place-journey story and a GameStop-like price story;
  - the Director must derive different **world types** (map vs chart/ticker), scene lists, style specs (Table B) and emphasis words;
  - each choice must carry a logged reason that is shown in Production Activity;
  - model-agnostic (the harness doesn't depend on the model config).
- **Requirements:** ST-DIR-001, ST-STY-001, ST-STY-003, ST-STY-005, ST-UX-065, ST-AG-004
- **AC:**
  - the world types differ;
  - the style specs pass the ST-STY-003 distance check;
  - 100% of world, scene, style-field and emphasis choices have a non-empty reason citing a subject or structure signal;
  - the reasons render in Production Activity;
  - the fixtures are never shipped.
- **Tests:** fixture suite; Production Activity snapshot.
- **Protected:** n/a.

## Video Quality (3)

### VQ-1: QA gates A1–A17 thresholds + rubric + benchmark — filed #1252
- **Owner:** Video Quality
- **Phase:** P1 (A2/A4/A5/A14/A15) → P2 (all)
- **Depends on:** D17
- **Scope:** implement and tune A1–A17; seeded-defect fixtures; rubric B1–B9; whole-frame reviews; P1 proof sign-off with John.
- **Requirements:** ST-QA-A1…A17, ST-QA-RUB, ST-COMP-002, ST-COMP-004, ST-UX-133, **ST-CMH-014 (seam threshold tuning), ST-CMH-016 (audio-tail thresholds), ST-CMH-018 (VQ handoff review: score each handoff ≥ 4/5 against John's "part of the actual documentary" bar; review every asymmetric exit and hard cut)**
- **Also covers (reference workflow, CoS 12:27 AM):** Tune the reference-workflow thresholds: A19 SFX vs speech (≤ 0 dB over the speech median, proposed), A18 edge ramp (30 px), the 40 px cap (ST-BLK-15), pace 120–125 wpm (ST-RW-001), and loudness defaults −15 LUFS / TP −1.5 (D34).
- **AC:** each check catches its fixture; rubric ≥ 4.0 on the proof set (P1 exit) and benchmark (release).
- **Tests:** fixture suite.
- **Protected:** VQ benchmark v1 unchanged.

### VQ-2: Decision-quality loop on exceptions — filed #1253
- **Owner:** Video Quality
- **Phase:** P2
- **Depends on:** BE-5
- **Scope:** review the Director's transition/insert/hard-cut exceptions; agreement metric; ≥ 80% target (D12).
- **Requirements:** ST-QA-DQ, ST-AG-004, ST-TR-006
- **AC:** report per benchmark run.
- **Tests:** n/a (review process).
- **Protected:** n/a.

### VQ-3: VQ findings → house defaults learning loop — filed #1254
- **Owner:** Video Quality
- **Phase:** P2
- **Depends on:** VQ-1, BE-1
- **Scope:** record each VQ finding as a lesson; automatically propose house-constant or director-rule changes; VQ approves; versioned with rollback (D32).
- **Requirements:** ST-RW-011, ST-STY-001, ST-STY-005
- **AC:** an approved lesson changes the house-constant version used by later projects; rollback works; unapproved lessons never change output.
- **Tests:** version/rollback tests.
- **Protected:** n/a.

## Security (5)

### SEC-1: Custom-code sandbox review — filed #1255
- **Owner:** Security
- **Phase:** P2 (before production)
- **Depends on:** RE-7, DO-1
- **Scope:** isolation, no network or secrets, resource/time limits, deterministic output, framework fallback, logging; pen-test the escape suite.
- **Requirements:** ST-SBX-001…007
- **AC:** sign-off recorded; findings fixed.
- **Tests:** escape suite review.
- **Protected:** n/a.

### SEC-2: Licences for what we ship (engine fonts and voices) — filed #1256
- **Owner:** Security (with John)
- **Phase:** P1
- **Depends on:** none
- **Scope:**
  - licence review of the bundled engine fonts and the Piper voices (Piper is not used for product narration per D28; the review covers what the vendored engine ships);
  - any base-map geometry we ship.
  - **No review of user uploads** (John 12:44 AM: the normal ToS covers them).
  - D26 and D29 were dropped (John 12:42 AM).
  - Found-media and download tooling stay with SEC-5 (later).
- **Requirements:** ST-ENG-002, ST-AUD-004 (generated music/SFX we ship)
- **AC:** sign-off per shipped asset.
- **Tests:** asset licence checklist.
- **Protected:** existing B-roll search.

### SEC-3: Biometric/face data review (BIPA/GDPR): flagged, not blocking — filed #1257
- **Owner:** Security
- **Phase:** P2 (parallel)
- **Depends on:** BE-7
- **Scope:** consent, notice, retention, deletion, cross-border processing (Gemini), the identity-suggestion policy.
- **Requirements:** ST-FACE-004…006
- **AC:** review recorded; required changes ticketed.
- **Tests:** deletion test review.
- **Protected:** n/a.

### SEC-4: Authz + secret hygiene for new routes, jobs and logs — filed #1258
- **Owner:** Security
- **Phase:** P2
- **Depends on:** BE-2, BE-12
- **Scope:** workspace authz on `/api/motion-studio/*`; no secrets, cookies or signed URLs in responses, logs, sandbox or catalog.
- **Requirements:** ST-RULE-005, ST-API-001, ST-SBX-003
- **AC:** review sign-off; scrub tests pass.
- **Tests:** authz tests.
- **Protected:** existing auth.

### SEC-5: Found-media licensing, provider terms and download tooling (LATER) — filed #1259
- **Owner:** Security (with John)
- **Phase:** **Later (John 12:33 AM)**. Fully specced, not in v1.
- **Depends on:** D4, BE-4 (later)
- **Scope:** licensing and terms review for automatically found media (stock providers, archival sources, video platforms) and the tools used to obtain it, before the later Media Researcher ships.
- **Requirements:** ST-MR-004…007, ST-MR-014, D4 (D29 dropped 12:42 AM; download tooling for found media stays here)
- **AC:** sign-off per provider and tool; automatic import stays disabled until it is signed.
- **Tests:** review of the licence-gate tests.
- **Protected:** existing B-roll search.

---

**Counts:** Render engine 12 · Backend (New) 21 · Frontend 12 · DevOps 2 · QA 7 · Video Quality 3 · Security 5 = **62 drafts** (BE-21 dropped: bake-off cancelled, John 12:58 AM) (BE-4, BE-19 and SEC-5 are Phase: later), none filed.
