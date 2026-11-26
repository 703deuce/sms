# COS-22: SMS-era production skill split into AgentLab lab-video-* / lab-engine-* skills (Nov 26, 2026)

Source (read-only copy): `/workspace/transovo_team/research/sms-production-skills/` (17-page hub `SKILL.md`,
RULES_FROM_RICK.md, qa.md, craft-standards.md, engines.md, engine-library.md, film-pipeline.md, retention-psychology.md,
retention-sources.md, craft/*.md). Working tree: `/workspace/cos22/v2/` (skills/, tools/video-stage, merged runner files).
Scope: films made from scratch only (no clip trimming, BYO-footage editing, Transovo delivery).

## How loading works now (t148u + t176u)
1. **First message (core, ~12.6K chars / ~3.2K tokens)**: `skill_gate.attach` inlines `lab-video-producer` plus the
   pages the router model (Haiku) picks from its `includes:`: always `lab-video-film` (stage map) and `lab-video-brief`,
   and exactly ONE type playbook `lab-video-types-<kind>` (model pick; router prompt line "choose exactly one"). No
   keyword matching anywhere.
2. **Each stage**: the agent runs `video-stage <stage>`; it prints that stage's SKILL.md pages verbatim (map:
   `lab-video-film/stages.json`) and logs each read (`kind: stage`, `via: video-stage`) in `log/read-manifest.jsonl`
   and `log/stage.json`. Earlier stages' pages are never reprinted (and, being `kind: stage`, are not re-injected by the
   condensation restore note); after a "[Context restored]" the agent reprints only the current stage.
3. **Build**: `video-stage build --scene <id>` prints only the engine pages that scene uses in `scenes/plan.json`
   (`scenes[].engine`, `layers[].engine`), `lab-engine-browser-contract` when a browser engine is among them, and the
   reference sections the plan names in `"refs": ["<page>/reference.md#<heading start>"]`, each once per film. The
   direction stage prints the list of available section headings so the plan can name real ones.
4. **Enforcement (existing routes only)**: `lab-video-producer` has `gate_cmd: video-stage --verify` (the existing
   skill_gate gate_cmd/send-back path): delivery is sent back if design/build/review/finish were never opened, if any
   plan-picked engine page or refs section was not printed, or if a refs name does not exist. `goal_judge.check` now
   adds `stage_facts()` to its facts: pages opened per stage, plan-picked pages not opened, and `log/stages.md` (the
   agent's one line per page: `stage | page | what it applied`); the judge returns continue when evidence is missing.
5. References are split into small `##` sections (largest 5.2K chars); the 19.6K retention source list moved to
   `lab-video-story/sources.md` (never auto-loaded). `read_section` (existing tool) still serves ad-hoc lookups.

## Stage map
| # | stage | pages printed | hands off |
|---|---|---|---|
| 0 | intake (first message) | producer, film, brief, one type playbook | log/job.md, log/checklist.md |
| 1 | research | lab-video-research, lab-video-story | research/facts.md, script.json |
| 2 | direction | lab-video-variety, lab-video-engines (+ refs heading index) | treatment.md, scenes/theme.json, scenes/plan.json |
| 3 | media | lab-video-media | assets/, research/sources.md |
| 4 | voice | lab-video-voice | narration.wav, words.json, timing.json |
| 5a | design | lab-video-build, lab-video-motion, lab-video-text | design/system.md, components |
| 5b | build | picked engine pages + browser contract + refs sections, per scene | scenes/<id>/, stills |
| 6 | sound | lab-video-sound | music, sfx, mix |
| 7 | review | lab-video-review (type playbook already in first message) | qa/ change-point approvals (before render) |
| 8 | finish | lab-video-edit, lab-video-look | one render, technical check, captions |

## Skills (SKILL.md lines / reference.md chars)
Core and stages: producer 49 · film 39 (+stages.json) · brief 42 · research 28 · story 64 / 43K (+sources.md) · variety 53 / 2.9K ·
engines 47 · media 43 · voice 44 · build 43 · motion 57 / 3.3K · text 42 / 6.8K · sound 60 / 2.4K (+gen_music.py) ·
review 52 / 7.4K (+review.py) · edit 74 / 13.2K (+getmusic.py, merge_cues.py) · look 57 / 4.3K.
Type playbooks: documentary 39 · music-culture 32 · news-explainer 38 · product-brand 35 · sports 40 · podcast-interview 55 · other 27.
Engines: cinematic 58 · hyperframes 39 · open-3d 38 · dolly 36 · remotion-social 38 · motion-canvas 34 · revideo 32 · pixijs 35 ·
threejs-theatre 37 · gsap-svg 36 · p5 34 · manim 35 · d3 35 · maplibre-deckgl 37 · rive 35 · lottie 35 · skia 35 ·
browser-contract 52 · footage-fx 38. Disabled (SKILL.md renamed): lab-engine-3d, -browser-fx, -data-maps, -remotion.

## Dropped
Clips/BYO footage editing, Rick names and provenance dates, Agent Bridge/webhooks/tokens/live delivery/Transovo editor
and server/SSH/Coolify, GitHub PR-per-rule, Files table, API-key lists, Replicate, §7 progress table, upload whitelist,
delivery contract, first-run section, customer_upload and legacy creative.style fields, the YouTube footage ban (t172u:
any site allowed, sources logged, player UI and logos hidden), render-then-watch (review is on stills before render).
Paid voice + generated music are ON by default (music ~$2, film total ~$5; free fallback when a key is missing or over budget).

## Dry-runs (Haiku only; total spend about $0.028 across three passes: $0.0083 + $0.0093 + $0.0103, including the router, the requirement extract and the plan stand-in)
Harness: `/workspace/cos22/dry/dry.py` on the server against a temp copy of skills and the merged skill_gate; a Haiku
call stands in for the agent writing `scenes/plan.json` from the direction-stage pages.
| brief | router pick | type playbook | explicit asks pinned | engines planned | verify |
|---|---|---|---|---|---|
| 1977 NYC blackout documentary, 60 s | producer | documentary only | 60-second, real archival footage, narration and music, scope line | cinematic (picture) + footage-fx, gsap-svg, maplibre, d3, threejs, remotion-social overlay | pass |
| battery explainer, "Use Manim", 9:16, <30 s | producer | news-explainer only | all 4 | manim honoured + gsap, threejs, remotion-social, footage-fx | pass |
| Morrow oat-milk promo, 20 s | producer | product-brand only | 3 | dolly, open-3d, pixijs, gsap, lottie, remotion-social | pass |
| Leicester 2015-16 recap, 45 s | producer | sports only | 2 | cinematic + d3, gsap, threejs, footage-fx | pass |
| control: trim clip to GIF | none | none | 5 quotes | n/a | n/a |
Pass 2 found the planner inventing reference section names; fixed by the direction-stage heading index and a verify
message that names a missing section. Pass 3: all refs resolved, all verifies pass.

## Tokens per stage, documentary dry-run (chars/4 estimate, not tokenizer-measured)
Core first message: 12,661 chars ≈ 3.2K tokens (present throughout).
| stage | stage pages + refs | ≈ tokens | with core |
|---|---|---|---|
| research | 6,200 | 1.6K | 4.7K |
| direction | 6,846 + 1,965 index | 2.2K | 5.4K |
| media | 2,533 | 0.6K | 3.8K |
| voice | 2,464 | 0.6K | 3.8K |
| design | 9,484 | 2.4K | 5.5K |
| build, per scene (S01/S02/S03/S04/S05) | 11,314 / 7,387 / 0 / 5,245 / 2,025 | 2.8K / 1.8K / 0 / 1.3K / 0.5K | max 6.0K |
| build, whole stage (all scenes) | 25,971 | 6.5K | **9.7K: over 6K** |
| sound | 3,495 | 0.9K | 4.1K |
| review | 3,639 | 0.9K | 4.1K |
| finish | 8,175 | 2.0K | 5.2K |
**Flag: build** (6 engines + browser contract + 3 refs sections). Trim proposals: (a) cap `refs` at 2 sections (-3K
chars); (b) move the RETURN/footage depth of `lab-engine-cinematic` into reference sections (-1.2K); (c) make
`lab-engine-footage-fx` a 1K core with SAM 2 / OpenCV / Natron / FFmpeg as ref sections (-1.5K); (d) browser contract
to a 1.5K core + sections (-1.3K); (e) cap the plan at 5 engine pages. Together ≈ -7K chars → whole build ≈ 4.7K tokens
(≈ 7.9K with core), every per-scene load under 5K. Not applied yet: waiting for John's call.

## Deploy (2026-11-26, 3:30-3:35 PM ET)
Skills and `tools/bin/video-stage` live; runner `skill_gate.py` (COS-21 live code + page picker + one-type line) and
`goal_judge.py` (+stage_facts) loaded by the single idle watcher at 3:34 PM ET (runner, skillroute healthy). Backups and
undo: `/opt/agent/backups/2026-11-26-production-split/ROLLBACK.md` (v3 section). Quick off: `runner/state/PAGE_PICK_OFF`.
Engines installed in the agent-lab container (/opt/engines): hyperframes 0.9.52, SAM 2 (CPU torch 2.15, tiny checkpoint),
Natron 2.5.0 portable, edge-tts 7.3.1; Dockerfile block for persistence noted, no rebuild done.

## Open items
- Motion Canvas and Revideo pages untested (no smoke tests, per John); rembg models not pre-downloaded.
- Engine installs live in the container's writable layer until the Dockerfile block is built.
- No real end-to-end film run yet on the new path (dry-runs only).

## v4: partial build trim (John t180u, 2026-11-26 ~3:50 PM ET; skills only, live at once, no restart)
Moved, nothing removed, no caps on engines or refs: Cinematic footage RETURN detail -> `lab-engine-cinematic/reference.md#Footage RETURN`;
`lab-engine-footage-fx` SKILL.md is a ~1.2K core pointing at its sections 13 SAM 2 / 14 OpenCV / 15 Natron / 16 FFmpeg;
`lab-engine-browser-contract` SKILL.md is a ~1.3K core (template, capture flags, layers, export rules, new
`#One art direction` theme.json section in reference.md). Stale `--canvas` mentions in five engine references corrected.
Backup/undo: ROLLBACK.md v4 section (skills-pre-v4.tgz).
Dry-run (documentary + brand, Haiku $0.005): routing unchanged (documentary / product-brand playbook only); footage-fx #13
printed when picked; a plan naming every moved section (Footage RETURN, #14, #15, #16, contract #0, #0b, export rules,
One art direction) printed all 11 refs; `--verify` passed.
Tokens, same documentary plan as v3 (chars/4): whole build 25,971 -> 22,904 chars (6.5K -> 5.7K tokens; 8.9K with core);
max per scene 11,314 -> 9,474 chars (2.8K -> 2.4K; 5.5K with core). Fresh v4 documentary plan: whole build 21,322 chars
(5.3K; 8.5K with core), max per scene 11,292 (2.8K; 6.0K with core). Other stages unchanged.
