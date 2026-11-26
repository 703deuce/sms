---
name: lab-engine-skia
description: Skia / CanvasKit on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: print-quality 2D: shaped text with any font, variable-font weight animation, SkSL shader backgrounds, path effects, blur and shadows.
attach_roles: stage
browser_engine: true
---

# Skia / CanvasKit

Status: installed: canvaskit-wasm 0.42 in /opt/engines/js.
**Pick it for** shaped paragraph text with any font file, variable-font weight animation, SkSL runtime shaders (procedural gradients, noise, liquid backgrounds), dash/trim path effects. **Why:** smooth print-quality type and procedural shader backgrounds: luxury, Swiss or minimal looks.
**Browser engine:** follow `lab-engine-browser-contract` (window.__scene, seek(t), alpha, theme.json).

## Setup
```bash
cp /opt/engines/js/node_modules/canvaskit-wasm/bin/canvaskit.js /opt/engines/js/node_modules/canvaskit-wasm/bin/canvaskit.wasm scenes/S14/lib/
# build inside the browser scene (wasm in the page), draw in seek(t)
```

## Review (stills at the change points, before any render)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S14 --still <times>
```

## Final render (once, after every scene is approved)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S14 --out scenes/S14/out/S14.mov --alpha
```
As a layer: transparent type or shader layer. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- Build it in the browser scene so it is reviewed like every browser engine.
- Detail and recipes: `reference.md`.
