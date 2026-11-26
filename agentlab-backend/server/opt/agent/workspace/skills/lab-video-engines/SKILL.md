---
name: lab-video-engines
description: The engine picker for a film from scratch: which engines own the picture and which are overlay-only, the scene-to-engine table, the engine pool by need, tie-breakers, installed status, and scenes/plan.json anchored to words.
when_to_use: Opened at the creative-direction stage (video-stage direction) to choose engines per layer and write scenes/plan.json.
page_line: Direction stage: choose engines per layer (picture vs overlay), installed status, tie-breakers, scenes/plan.json anchored to words.
attach_roles: stage
---

# Engines: choose per layer, then plan (stage 2)

**The main engines carry the picture; Remotion is overlay/typography only.** Documentary and researched films:
Cinematic Skill world + real footage. Product/app/ad: Dolly or Open 3D. Editorial/infographic: HyperFrames.
Survey the whole pool each film; choose each **layer** for how it looks, with one real alternative considered.
No fixed pairings, no engine-count limit; at least 3 engines across a film (`lab-video-variety`).

| The scene is... | First choice | Also good |
|---|---|---|
| narrated doc spine: one camera over photos, documents, maps, numbers, hits on words | `cinematic` | `threejs-theatre` photo planes, `revideo` footage walls |
| maps and travel | `cinematic` paper map, `maplibre-deckgl` real 3D flights | `d3` geo projection |
| evidence board, investigation, timeline | `cinematic` | `hyperframes` |
| data as the world / editorial charts | `cinematic` + custom item; `hyperframes`, `d3` | `manim`, `revideo` counters, `skia` |
| editorial motion graphics, infographics, explainer panels | `hyperframes` | `gsap-svg`, `motion-canvas`/`revideo` |
| product, SaaS, app demo, launch, ad | `dolly` | `threejs-theatre`, `remotion-social` |
| cinematic 3D, exploded how-it-works | `open-3d` | `threejs-theatre` (motion-design 3D) |
| kinetic type, titles, captions-as-graphics | `gsap-svg`, `remotion-social` (overlay) | `hyperframes`, `skia`, 3D type |
| backgrounds and texture | `pixijs`, `p5` | `skia` shaders, FFmpeg grain |
| accents (icons, bursts, underlines) | `lottie`, `rive` | `gsap-svg` DrawSVG, `pixijs` bursts |
| maths and logic explainers | `manim` | `motion-canvas`/`revideo`, `open-3d` exploded |
| footage treatment (cut-outs, tracked callouts, ramps) | `footage-fx` | |

Status (all under `/opt/engines`): installed and tested here: cinematic, remotion-social, gsap-svg, threejs-theatre,
manim, (capture script). Installed, not render-tested: hyperframes 0.9.52, open-3d, dolly, motion-canvas, revideo,
pixijs, p5, d3, maplibre-deckgl (tiles need network), rive, lottie, skia, SAM 2 (CPU), Natron 2.5 (headless
unproven), rembg/MediaPipe (models download on first use). Untested is never a reason to skip the best engine; if
one fails, say so and pick another at least as good. No Blender, Godot or Unreal (no GPU). Quick file check only.

## Tie-breakers
- One art direction across engines (`scenes/theme.json`); a cut between engines must read as the same film.
- When two options fit equally, pick the one recent ledger entries have not used.
- Never let engine choice drive the story; if no engine fits a planned scene, change the plan and log why.

## `scenes/plan.json` (the build reads it; `video-stage build` opens the engine pages from it)
`{"type": "lab-video-types-<kind>", "scenes": [{"id": "S01", "engine": "lab-engine-cinematic", "start": {"line":
"L03", "word": "verdict"}, "end": {"line": "L05", "word": "years"}, "layers": [{"engine": "lab-engine-gsap-svg",
"role": "type"}], "footage": [...], "transition": "...", "camera": "..."}], "refs": ["lab-engine-cinematic/reference.md#Documentary board scene"]}`.
`refs` names only the reference sections you will actually use at build (heading start, one small section each). Start/end are anchored to a script
line and word, never seconds. Engine values are exact page slugs.
