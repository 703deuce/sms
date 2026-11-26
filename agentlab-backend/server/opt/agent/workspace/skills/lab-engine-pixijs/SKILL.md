---
name: lab-engine-pixijs
description: PixiJS v8 on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: fast 2D WebGL particles, glow, bloom, RGB split, liquid distortion, photo shatter; energetic textured backgrounds and FX layers.
attach_roles: stage
browser_engine: true
---

# PixiJS v8

Status: installed: pixi.js 8.x + pixi-filters 6.x in /opt/engines/js.
**Pick it for** thousands of particles, sprite swarms, displacement and liquid distortion, glow, bloom, RGB split, CRT/old-film filters, photo shatter. **Why:** energetic, glowing, textured 2D: sports-hype energy, neon, kinetic backgrounds, photos that ripple or burst.
**Browser engine:** follow `lab-engine-browser-contract` (window.__scene, seek(t), alpha, theme.json).

## Setup
```bash
cp /opt/engines/js/node_modules/pixi.js/dist/pixi.min.mjs /opt/engines/js/node_modules/pixi-filters/dist/pixi-filters.mjs scenes/S04/lib/
# app.init({canvas, backgroundAlpha:0, autoStart:false, preference:"webgl", preserveDrawingBuffer:true}); app.ticker.stop(); draw in seek(t) then app.render()
```

## Review (stills at the change points, before any render)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S04 --still <times>
```

## Final render (once, after every scene is approved)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S04 --out scenes/S04/out/S04.mov --alpha
```
As a layer: particle or FX layer under the type, over the plate. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Seed any randomness so frames repeat exactly.
- Detail and recipes: `reference.md`.
