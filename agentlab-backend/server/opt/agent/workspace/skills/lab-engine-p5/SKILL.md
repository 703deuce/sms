---
name: lab-engine-p5
description: p5.js 2.x on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: generative and organic visuals: flow fields, halftone and dither photo treatments, hand-drawn lines, ink and paper textures, glitch.
attach_roles: stage
browser_engine: true
---

# p5.js 2.x

Status: installed: p5 2.x in /opt/engines/js.
**Pick it for** noise flow fields, halftone/dither treatments of photos, hand-drawn wobble lines, ink and paper textures, pixel sorting, glitch. **Why:** artsy, handmade, analogue-digital: collage, zine, retro and glitch looks.
**Browser engine:** follow `lab-engine-browser-contract` (window.__scene, seek(t), alpha, theme.json).

## Setup
```bash
cp /opt/engines/js/node_modules/p5/lib/p5.min.js scenes/S09/lib/
# instance mode, noLoop(); seek: t => { T = t; inst.redraw(); }; seed randomSeed/noiseSeed; await loadImage before __ready
```

## Review (stills at the change points, before any render)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S09 --still <times>
```

## Final render (once, after every scene is approved)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S09 --out scenes/S09/out/S09.mov --alpha
```
As a layer: texture, scribble or grain layer (`clear()` not `background()`). Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Detail and recipes: `reference.md`.
