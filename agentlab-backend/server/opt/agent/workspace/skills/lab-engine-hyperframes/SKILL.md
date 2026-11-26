---
name: lab-engine-hyperframes
description: HyperFrames (HTML/CSS + GSAP to video) on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Core engine: editorial HTML/CSS motion graphics, infographics, data cards, strong typographic systems, true alpha output; ~450 registry blocks.
attach_roles: stage
---

# HyperFrames (HTML/CSS + GSAP to video)

Status: installed: CLI hyperframes 0.9.52 in /opt/engines/js (matches source /opt/engines/repos/hyperframes @ e426ce4).
**Pick it for** editorial motion graphics, infographics and chart panels, explainer panels, decision trees, typographic layouts with a strong design system; titles and lower thirds on their own alpha track. **Why:** deterministic seek-render of plain HTML/CSS with one paused GSAP timeline; a registry of editable blocks; real alpha (`--format webm|mov`).

## Setup
```bash
H=/opt/engines/js/node_modules/.bin/hyperframes   # always this pinned 0.9.52, never `npx hyperframes@latest`
$H init scenes/S05 --skip-skills && cd scenes/S05
$H add <block>            # search the registry before hand-writing an effect
$H lint && $H check --json   # fix every error
```

## Review (stills at the change points, before any render)
```bash
$H snapshot --at 1,3,5    # PNGs under .hyperframes/artifacts/snapshots/ (times from review.py times)
```

## Final render (once, after every scene is approved)
```bash
$H render --quality delivery -o out/S05.mp4
$H render --format webm -o out/S05_overlay.webm   # transparent layer (--format mov = ProRes)
```
As a layer: webm/mov with alpha over the picture, composited in the scene runtime. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Contract: every timed element `class="clip"` with `data-start`/`data-duration`; one paused GSAP timeline on `window.__timelines`; no `Date.now()`, unseeded random, network fetches or timers; assets via `assets/` paths.
- Its manual's "stop for approval" steps assume a human: do the check, snapshot and review loop yourself.
- Never sign in to HeyGen or enable paid models; opt out of CLI telemetry (`DO_NOT_TRACK=1`).
- Manuals: /opt/engines/repos/hyperframes/skills/{hyperframes,hyperframes-cli,hyperframes-registry}/SKILL.md.
- Detail and recipes: `reference.md`.
