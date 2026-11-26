---
name: lab-engine-rive
description: Rive on this lab: when to pick it, setup, review stills, the final render command and gotchas.
when_to_use: Attached at the build stage only when this job's scenes/plan.json picks this engine for a layer (by video-stage, from the plan); named by lab-video-engines.
page_line: Library engine: plays .riv state-machine animations (characters, animated icons, badges, counters) with runtime text and inputs.
attach_roles: stage
browser_engine: true
---

# Rive

Status: installed: @rive-app/canvas + canvas-advanced 2.x in /opt/engines/js.
**Pick it for** state-machine character and UI animations, animated icons, mascots, badges and counters from a .riv. **Why:** smooth, app-like, playful vector character motion.
**Browser engine:** follow `lab-engine-browser-contract` (window.__scene, seek(t), alpha, theme.json).

## Setup
```bash
cp /opt/engines/js/node_modules/@rive-app/canvas-advanced/{canvas_advanced.mjs,rive.wasm,rive_fallback.wasm} scenes/S12/lib/
# seek advances the artboard by the delta since the last frame (capture always seeks forward)
```

## Review (stills at the change points, before any render)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S12 --still <times>
```

## Final render (once, after every scene is approved)
```bash
node /workspace/skills/lab-engine-browser-contract/capture.mjs --dir scenes/S12 --out scenes/S12/out/S12.mov --alpha
```
As a layer: badge, icon or mascot accent layer. Exact frame count = round(duration x 30); 30 fps CFR; no audio in scene clips.

## Gotchas
- .riv files cannot be authored in code: use free community files or supplied ones, and change text, colours and inputs so it never looks stock.
- Detail and recipes: `reference.md`.
