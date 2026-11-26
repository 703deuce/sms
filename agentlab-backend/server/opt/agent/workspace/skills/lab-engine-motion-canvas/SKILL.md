---
name: lab-engine-motion-canvas
description: Motion Canvas on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: precise programmatic vector animation (code morphs, diagrams, flowcharts, maths-style explainers); render it headless with Revideo.
attach_roles: stage
---

# Motion Canvas

Status: installed: @motion-canvas/* 3.17.2 + vite 5.4.21 in /opt/engines/js; not render-tested here.
**Pick it for** precise vector animation driven by generators and signals: code blocks that morph line by line, diagrams, flowcharts, tidy shape choreography. **Why:** clean, flat, exact vector motion with springy procedural tweens; an "engineered" explainer look, a strong change from Cinematic's paper world.

## Setup
```bash
# write the scene in Motion Canvas syntax (makeScene2D, generators), then render it with Revideo (lab-engine-revideo), which shares the scene API and renders headless
```

## Review (stills at the change points, before any render)
```bash
# Revideo renders single frames for review (see lab-engine-revideo); the Motion Canvas editor needs a browser session: avoid it
```

## Final render (once, after every scene is approved)
```bash
# via Revideo renderVideo(); for alpha: export an Image sequence with a transparent background, then
ffmpeg -framerate 30 -i %06d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le layer.mov
```
As a layer: PNG-sequence alpha layer. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Motion Canvas renders from its editor, not a CLI: for unattended work use Revideo with the same scene code.
- Source of truth for the API: /opt/engines/js/node_modules/@motion-canvas/2d and core typings.
- Detail and recipes: `reference.md`.
